# ============================================================
# MAIZE CLASSIFICATION API - FIXED FOR KERAS VERSION ISSUES
# ============================================================

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import traceback
import requests  # ✅ ADDED for downloading images from URL

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf
import numpy as np
from PIL import Image
import io as iolib

app = Flask(__name__)
CORS(app)

# ============================================================
# PATHS
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FOLDER = os.path.join(BASE_DIR, 'models', 'corn_model.keras')
MODEL_PATH = os.path.join(MODEL_FOLDER, 'corn_model_final.h5')

IMG_SIZE = 224
NUM_CLASSES = 12
model = None
MODEL_LOADED = False
LOAD_ERROR = None

CLASS_LABELS = [
    'Agalwoi_white_Good', 'Agalwoi_white_damged', 'Agalwoi_white_impure',
    'Hybrid_local_white_damaged', 'Hybrid_local_white_good', 'Hybrid_local_white_impure',
    'Popcorn_damaged', 'Popcorn_good', 'Popcorn_impure',
    'Redcorn_damaged', 'Redcorn_good', 'Redcorn_impure'
]

VARIETY_CLEAN_NAMES = {
    'Agalwoi_white': 'Agalwoi White',
    'Hybrid_local_white': 'Hybrid Local White',
    'Popcorn': 'Popcorn',
    'Redcorn': 'Redcorn'
}

# ============================================================
# BUILD MODEL ARCHITECTURE (EXACT MATCH TO YOUR TRAINING)
# ============================================================
def build_model_architecture():
    print("   Building model architecture...")
    base = tf.keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights=None
    )
    base.trainable = False
    
    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = base(inputs, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dense(512, activation='relu',
                              kernel_regularizer=tf.keras.regularizers.l2(1e-4))(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.45)(x)
    x = tf.keras.layers.Dense(256, activation='relu',
                              kernel_regularizer=tf.keras.regularizers.l2(1e-4))(x)
    x = tf.keras.layers.Dropout(0.315)(x)
    outputs = tf.keras.layers.Dense(NUM_CLASSES, activation='softmax')(x)
    return tf.keras.Model(inputs, outputs)


# ============================================================
# LOAD MODEL WITH KERAS VERSION FIX
# ============================================================
def load_model_safe():
    global model, MODEL_LOADED, LOAD_ERROR
    print("\n" + "="*70)
    print("🔄 LOADING MODEL")
    print("="*70)
    print(f"TensorFlow: {tf.__version__}")
    print(f"Model path: {MODEL_PATH}")
    print(f"File exists: {os.path.exists(MODEL_PATH)}")

    if not os.path.exists(MODEL_PATH):
        LOAD_ERROR = "Model file not found"
        print(f"❌ {LOAD_ERROR}")
        return False

    # -------- METHOD 1: Load with safe_mode (TF 2.16+) --------
    try:
        print("\n[Method 1] Loading with safe_mode=False...")
        model = tf.keras.models.load_model(MODEL_PATH, compile=False, safe_mode=False)
        model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
        MODEL_LOADED = True
        print("✅ Method 1 SUCCESS!")
        return True
    except TypeError:
        # safe_mode doesn't exist in older TF versions
        pass
    except Exception as e:
        print(f"❌ Method 1 failed: {str(e)[:150]}")

    # -------- METHOD 2: Rebuild architecture + load weights --------
    try:
        print("\n[Method 2] Rebuilding model + loading weights...")
        rebuilt = build_model_architecture()
        rebuilt.load_weights(MODEL_PATH, skip_mismatch=True, by_name=False)
        rebuilt.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
        model = rebuilt
        MODEL_LOADED = True
        print("✅ Method 2 SUCCESS!")
        return True
    except Exception as e:
        print(f"❌ Method 2 failed: {str(e)[:150]}")

    # -------- METHOD 3: Manual H5 weight loading --------
    try:
        import h5py
        print("\n[Method 3] Manual H5 weight loading...")
        
        rebuilt = build_model_architecture()
        
        with h5py.File(MODEL_PATH, 'r') as f:
            if 'model_weights' in f:
                weight_names = list(f['model_weights'].keys())
            else:
                weight_names = list(f.keys())
            
            print(f"   Found {len(weight_names)} weight groups in H5 file")
            
            # Load weights layer by layer
            for layer in rebuilt.layers:
                if layer.name in weight_names:
                    try:
                        weights = []
                        if 'model_weights' in f:
                            layer_group = f['model_weights'][layer.name]
                        else:
                            layer_group = f[layer.name]
                        
                        if hasattr(layer_group, 'keys'):
                            for w_name in layer_group.keys():
                                weights.append(layer_group[w_name][()])
                        
                        if weights and len(weights) == len(layer.get_weights()):
                            layer.set_weights(weights)
                    except Exception as e:
                        pass
        
        rebuilt.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
        model = rebuilt
        MODEL_LOADED = True
        print("✅ Method 3 SUCCESS!")
        return True
    except Exception as e:
        print(f"❌ Method 3 failed: {str(e)[:150]}")
        traceback.print_exc()

    LOAD_ERROR = "All loading methods failed. Check TensorFlow version compatibility."
    print(f"\n❌ {LOAD_ERROR}")
    return False


# ============================================================
# PREPROCESSING
# ============================================================
def preprocess_image(image):
    if image.mode != 'RGB':
        image = image.convert('RGB')
    image = image.resize((IMG_SIZE, IMG_SIZE), Image.Resampling.BILINEAR)
    img_array = np.array(image, dtype=np.float32)
    img_array = tf.keras.applications.mobilenet_v2.preprocess_input(img_array)
    return np.expand_dims(img_array, axis=0)


# ============================================================
# PARSE PREDICTION
# ============================================================
def parse_prediction(full_class_name):
    parts = full_class_name.split('_')
    grade = parts[-1].lower().replace('damged', 'damaged')
    variety_key = '_'.join(parts[:-1])
    clean_name = VARIETY_CLEAN_NAMES.get(variety_key, variety_key.replace('_', ' '))
    return clean_name, grade


# ============================================================
# ROUTES
# ============================================================
@app.route('/status', methods=['GET'])
def status():
    return jsonify({
        'status': 'running',
        'model_loaded': MODEL_LOADED,
        'load_error': LOAD_ERROR,
        'tensorflow_version': tf.__version__,
        'model_path': MODEL_PATH,
        'model_file_exists': os.path.exists(MODEL_PATH),
        'num_classes': NUM_CLASSES
    })


# ✅ UPDATED: Accept both file upload (web) and URL (Android)
@app.route('/classify', methods=['POST'])
def classify():
    if not MODEL_LOADED:
        return jsonify({
            'success': False,
            'error': f'Model not loaded. Reason: {LOAD_ERROR}'
        }), 500

    image = None

    # ✅ Option 1: Android sends image URL as JSON
    if request.is_json:
        data = request.get_json()
        image_url = data.get('image_url')
        if image_url:
            print(f"📥 Downloading image from URL: {image_url}")
            try:
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()
                image = Image.open(io.BytesIO(response.content))
                print(f"✅ Image downloaded successfully ({len(response.content)} bytes)")
            except Exception as e:
                print(f"❌ Failed to download image: {str(e)}")
                return jsonify({'success': False, 'error': f'Failed to download image: {str(e)}'}), 400

    # ✅ Option 2: Web sends file upload
    if not image and 'image' in request.files:
        file = request.files['image']
        if not file.filename:
            return jsonify({'success': False, 'error': 'Empty filename'}), 400
        try:
            image = Image.open(io.BytesIO(file.read()))
            print(f"✅ File upload received: {file.filename}")
        except Exception as e:
            print(f"❌ Failed to read file: {str(e)}")
            return jsonify({'success': False, 'error': f'Failed to read file: {str(e)}'}), 400

    if not image:
        return jsonify({'success': False, 'error': 'No image provided (neither URL nor file)'}), 400

    try:
        processed = preprocess_image(image)
        predictions = model.predict(processed, verbose=0)[0]

        idx = int(np.argmax(predictions))
        confidence = float(predictions[idx])
        full_name = CLASS_LABELS[idx]
        variety, grade = parse_prediction(full_name)

        response = {
            'success': True,
            'classification': variety,
            'variety': variety,
            'grade': grade,
            'confidence': round(confidence * 100, 2),
            'full_prediction': full_name
        }

        print(f"✅ {variety} | {grade} | {round(confidence*100, 2)}%")
        return jsonify(response), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/debug-classify', methods=['POST'])
def debug_classify():
    if not MODEL_LOADED:
        return jsonify({'success': False, 'error': 'Model not loaded'}), 500
    
    file = request.files.get('image')
    if not file:
        return jsonify({'success': False, 'error': 'No image'}), 400

    try:
        image = Image.open(iolib.BytesIO(file.read()))
        processed = preprocess_image(image)
        predictions = model.predict(processed, verbose=0)[0]

        results = []
        for i, prob in enumerate(predictions):
            variety, grade = parse_prediction(CLASS_LABELS[i])
            results.append({
                "class": CLASS_LABELS[i],
                "variety": variety,
                "grade": grade,
                "confidence": round(float(prob)*100, 2)
            })

        results.sort(key=lambda x: x["confidence"], reverse=True)
        return jsonify({"success": True, "top_5": results[:5]})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================
# MAIN
# ============================================================
if __name__ == '__main__':
    print("="*70)
    print("🌽 MAIZE CLASSIFICATION API - Keras Version Fix")
    print("="*70)
    load_model_safe()
    print("\n📌 Visit: http://localhost:5000/status")
    print("="*70 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=False)