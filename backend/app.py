# ============================================================
# 🌽 CORN CLASSIFICATION API (FOR YOUR FOLDER STRUCTURE)
# ============================================================

import os
import io
import json
import base64
import traceback

from flask import Flask, request, jsonify
from flask_cors import CORS

import numpy as np
import tensorflow as tf
from PIL import Image


# ============================================================
# PATH CONFIG
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_DIR = os.path.join(BASE_DIR, "models", "corn_model.keras")

MODEL_PATH = os.path.join(MODEL_DIR, "corn_model_final.h5")

# ✅ FIXED: class_labels.json is in backend/ root, not inside models/
LABELS_PATH = os.path.join(BASE_DIR, "models", "class_labels.json")

IMG_SIZE = 224

# ============================================================
# FLASK SETUP
# ============================================================

app = Flask(__name__)
CORS(app)

model = None
CLASS_LABELS = None


# ============================================================
# LOAD MODEL
# ============================================================

def load_model():
    global model, CLASS_LABELS

    print("====================================")
    print("Loading model...")
    print("Model path:", MODEL_PATH)
    print("Labels path:", LABELS_PATH)
    print("Model file exists:", os.path.exists(MODEL_PATH))
    print("Labels file exists:", os.path.exists(LABELS_PATH))

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError("Model file not found.")

    # ✅ Direct load (NO rebuilding)
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)

    model.compile(
        optimizer="adam",
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )

    print("✅ Model loaded successfully")
    print("Model output shape:", model.output_shape)

    # ✅ Load correct class order
    if not os.path.exists(LABELS_PATH):
        raise FileNotFoundError("class_labels.json not found.")

    with open(LABELS_PATH, "r") as f:
        CLASS_LABELS = json.load(f)

    print("✅ Class labels loaded")
    print("Number of classes:", len(CLASS_LABELS))
    print("====================================")


# ============================================================
# PREPROCESSING (MATCHES TRAINING)
# ============================================================

def preprocess_image(image):
    if image.mode != "RGB":
        image = image.convert("RGB")

    image = image.resize((IMG_SIZE, IMG_SIZE), Image.Resampling.BILINEAR)

    img_array = np.array(image, dtype=np.float32)

    # ✅ EXACT SAME preprocessing used in training
    img_array = tf.keras.applications.mobilenet_v2.preprocess_input(img_array)

    img_array = np.expand_dims(img_array, axis=0)

    return img_array


# ============================================================
# ROUTES
# ============================================================

@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "status": "running",
        "model_loaded": model is not None,
        "num_classes": len(CLASS_LABELS) if CLASS_LABELS else 0
    })


@app.route("/classify", methods=["POST"])
def classify():
    try:
        if model is None:
            return jsonify({"success": False, "error": "Model not loaded"}), 500

        image = None

        # ✅ JSON base64
        if request.is_json:
            data = request.get_json()
            if "image_base64" in data:
                image_base64 = data["image_base64"]

                if "," in image_base64:
                    image_base64 = image_base64.split(",", 1)[1]

                image_bytes = base64.b64decode(image_base64)
                image = Image.open(io.BytesIO(image_bytes))

        # ✅ File upload
        if not image and "image" in request.files:
            file = request.files["image"]
            image = Image.open(io.BytesIO(file.read()))

        if image is None:
            return jsonify({
                "success": False,
                "error": "No image provided"
            }), 400

        # Preprocess
        processed = preprocess_image(image)

        # Predict
        predictions = model.predict(processed, verbose=0)[0]

        idx = int(np.argmax(predictions))
        confidence = float(predictions[idx])
        predicted_class = CLASS_LABELS[idx]

        return jsonify({
            "success": True,
            "prediction": predicted_class,
            "confidence": round(confidence * 100, 2),
            "all_probabilities": {
                CLASS_LABELS[i]: round(float(p) * 100, 2)
                for i, p in enumerate(predictions)
            }
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================================
# MAIN
# ============================================================

# ✅ Load the model at IMPORT time so it's ready under gunicorn / Render too
# (gunicorn imports this file, so it never runs the __main__ block below).
print("\n🌽 CORN CLASSIFICATION API")
load_model()

if __name__ == "__main__":
    # ✅ Use the port Render provides via $PORT (falls back to 5000 locally).
    port = int(os.environ.get("PORT", 5000))
    print(f"\n✅ Server running at http://0.0.0.0:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)