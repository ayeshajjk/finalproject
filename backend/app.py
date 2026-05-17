import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# Limit GPU memory
import tensorflow as tf
gpus = tf.config.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    except RuntimeError as e:
        print(e)

import numpy as np
from PIL import Image
import json
import io

app = Flask(__name__)
CORS(app)

# ============================================================
# PATHS
# ============================================================
MODEL_PATH  = 'models/corn_model.keras/corn_model_final.h5'
CONFIG_PATH = 'models/config.json'
LABELS_PATH = 'models/class_labels.json'

# ============================================================
# REBUILD MODEL ARCHITECTURE (Keras 3 -> TF 2.15 compat)
# ============================================================
def build_model_architecture(num_classes=4, img_size=224):
    """
    Rebuild the exact CornMobileNetV2 architecture using TF 2.15 API.
    Architecture: MobileNetV2 (frozen) -> GAP -> BN -> Dense(256) -> 
                  Dropout(0.5) -> BN -> Dense(num_classes, softmax)
    """
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(img_size, img_size, 3),
        include_top=False,
        weights=None  # We'll load weights from h5
    )
    base_model.trainable = False

    inputs = tf.keras.Input(shape=(img_size, img_size, 3))
    x = base_model(inputs, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.BatchNormalization(momentum=0.99)(x)
    x = tf.keras.layers.Dense(256, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.5)(x)
    x = tf.keras.layers.BatchNormalization(momentum=0.99)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation='softmax')(x)

    model = tf.keras.Model(inputs, outputs, name='CornMobileNetV2')
    return model


def load_model_safe():
    """Load model by rebuilding architecture and loading weights from h5"""
    import h5py

    print("Loading model...")

    # Method 1: Rebuild architecture + load weights by name
    try:
        print("   Trying: Rebuild architecture + load weights by name...")
        rebuilt = build_model_architecture(num_classes=4, img_size=224)

        with h5py.File(MODEL_PATH, 'r') as f:
            # Check h5 structure
            if 'model_weights' in f:
                weight_group = f['model_weights']
            else:
                weight_group = f

            for layer in rebuilt.layers:
                name = layer.name
                if name in weight_group:
                    grp = weight_group[name]
                    weight_names = []
                    if name in grp:
                        sub = grp[name]
                        weight_names = [sub[wn][()] for wn in sub]
                    elif len(grp.keys()) > 0:
                        # Try flat structure
                        first_key = list(grp.keys())[0]
                        sub = grp[first_key] if isinstance(grp[first_key], h5py.Group) else grp
                        weight_names = [sub[wn][()] for wn in sub] if isinstance(sub, h5py.Group) else [grp[first_key][()]]
                    
                    if weight_names:
                        try:
                            layer.set_weights(weight_names)
                        except Exception as we:
                            pass  # Skip layers with shape mismatches

        rebuilt.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        print("Model loaded successfully (rebuild + h5 weights)")
        return rebuilt, True

    except Exception as e1:
        print(f"   Method 1 failed: {e1}")

    # Method 2: Rebuild + load_weights with skip_mismatch
    try:
        print("   Trying: Rebuild + load_weights(by_name, skip_mismatch)...")
        rebuilt = build_model_architecture(num_classes=4, img_size=224)
        rebuilt.load_weights(MODEL_PATH, by_name=True, skip_mismatch=True)
        rebuilt.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        print("Model loaded successfully (rebuild + load_weights)")
        return rebuilt, True

    except Exception as e2:
        print(f"   Method 2 failed: {e2}")

    # Method 3: Direct load (for older format h5 files)
    try:
        print("   Trying: Direct load_model...")
        loaded_model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        loaded_model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        print("Model loaded successfully (direct load)")
        return loaded_model, True

    except Exception as e3:
        print(f"   Method 3 failed: {e3}")

    print("All loading methods failed!")
    return None, False


print("\n" + "=" * 60)
print("🌽 MAIZE CLASSIFICATION & GRADING API")
print("=" * 60)

# Load model
model, MODEL_LOADED = load_model_safe()

if MODEL_LOADED and model is not None:
    try:
        print(f"   Input  shape: {model.input_shape}")
        print(f"   Output shape: {model.output_shape}")
    except:
        print("   ⚠️  Could not print model shapes")

# ============================================================
# LOAD CLASS LABELS
# ============================================================
print("🔄 Loading class labels...")
try:
    with open(LABELS_PATH, 'r') as f:
        CLASS_LABELS = json.load(f)
    print(f"✅ Classes: {CLASS_LABELS}")
except Exception as e:
    print(f"❌ Error loading labels: {e}")
    CLASS_LABELS = ['Agalwoi White', 'Hybrid Local White', 'Popcorn', 'Redcorn']
    print(f"   Using default classes: {CLASS_LABELS}")

# ============================================================
# LOAD CONFIG
# ============================================================
print("🔄 Loading configuration...")
try:
    with open(CONFIG_PATH, 'r') as f:
        project_config = json.load(f)
        IMG_SIZE = project_config.get('img_size', 224)
    print(f"✅ Image size: {IMG_SIZE}x{IMG_SIZE}")
except Exception as e:
    print(f"⚠️  Using default IMG_SIZE=224: {e}")
    IMG_SIZE = 224

# ============================================================
# GRADING LOGIC
# ============================================================
def determine_quality_grade(image_array):
    """
    Determine quality grade based on image statistics.
    Good:    High brightness, low variation
    Impure:  Very dark or very high variation
    Damaged: Everything in between
    """
    brightness = float(np.mean(image_array))
    std_dev    = float(np.std(image_array))

    print(f"   📊 Brightness: {brightness:.3f} | Std Dev: {std_dev:.3f}")

    if brightness > 0.5 and std_dev < 0.25:
        return "good"
    elif brightness < 0.3 or std_dev > 0.35:
        return "impure"
    else:
        return "damaged"

# ============================================================
# IMAGE PREPROCESSING
# ============================================================
def preprocess_image(image):
    """Preprocess image for model prediction"""
    
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    image = image.resize((IMG_SIZE, IMG_SIZE))
    img_array = np.array(image) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array

# ============================================================
# ROUTES
# ============================================================

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'status'   : 'Maize Classification API is running! 🌽',
        'version'  : '1.0',
        'model_status': 'loaded' if MODEL_LOADED else 'not loaded',
        'endpoints': {
            'info'    : '/info (GET)',
            'classify': '/classify (POST with image)',
            'health'  : '/health (GET)'
        }
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': MODEL_LOADED,
        'tensorflow_version': tf.__version__,
        'gpu_available': len(tf.config.list_physical_devices('GPU')) > 0
    })


@app.route('/info', methods=['GET'])
def info():
    return jsonify({
        'status'        : 'ready' if MODEL_LOADED else 'model not loaded',
        'model_loaded'  : MODEL_LOADED,
        'varieties'     : CLASS_LABELS,
        'num_varieties' : len(CLASS_LABELS),
        'image_size'    : f'{IMG_SIZE}x{IMG_SIZE}',
        'quality_grades': ['good', 'damaged', 'impure'],
        'tensorflow_version': tf.__version__
    })


@app.route('/classify', methods=['POST'])
def classify():
    """Classify maize variety and determine quality grade"""
    
    # Check model
    if not MODEL_LOADED or model is None:
        return jsonify({
            'success': False,
            'error'  : 'Model is not loaded. Please check server logs.'
        }), 500
    
    # Check image
    if 'image' not in request.files:
        return jsonify({
            'success': False,
            'error'  : 'No image provided. Send image with key "image".'
        }), 400
    
    try:
        # Read and preprocess image
        file            = request.files['image']
        image_bytes     = file.read()
        image           = Image.open(io.BytesIO(image_bytes))
        
        print(f"\n📸 Image: {file.filename} | Mode: {image.mode} | Size: {image.size}")
        
        processed_image = preprocess_image(image)
        
        # Predict variety
        print("🔄 Predicting...")
        predictions = model.predict(processed_image, verbose=0)
        
        predicted_index   = int(np.argmax(predictions[0]))
        predicted_variety = CLASS_LABELS[predicted_index]
        confidence        = float(predictions[0][predicted_index])
        
        # All predictions as percentages sorted by confidence
        all_predictions = dict(
            sorted(
                {CLASS_LABELS[i]: round(float(predictions[0][i]) * 100, 2)
                 for i in range(len(CLASS_LABELS))}.items(),
                key=lambda x: x[1],
                reverse=True
            )
        )
        
        # Grade
        quality_grade = determine_quality_grade(processed_image[0])
        
        response = {
            'success'          : True,
            'predicted_class'  : predicted_variety,
            'predicted_variety': predicted_variety,
            'grade'            : quality_grade,
            'confidence'       : round(confidence * 100, 2),
            'all_predictions'  : all_predictions,
        }
        
        print(f"✅ Variety   : {predicted_variety}")
        print(f"✅ Grade     : {quality_grade}")
        print(f"✅ Confidence: {confidence * 100:.2f}%")
        
        return jsonify(response)
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error'  : str(e)
        }), 500


# ============================================================
# START SERVER
# ============================================================
if __name__ == '__main__':
    print(f"\n🌾 Varieties : {', '.join(CLASS_LABELS)}")
    print(f"🏆 Grades    : good, damaged, impure")
    print(f"📏 Image Size: {IMG_SIZE}x{IMG_SIZE}")
    print(f"🤖 Model     : {'✅ Loaded' if MODEL_LOADED else '❌ NOT LOADED'}")
    print(f"🌐 Server    : http://localhost:5000")
    print(f"🔧 TensorFlow: {tf.__version__}")
    print("=" * 60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)