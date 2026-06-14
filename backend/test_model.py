# debug_model.py - Model Debugging Script
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf
import numpy as np
from PIL import Image
import json

print("="*60)
print("🔍 MODEL DEBUGGING SCRIPT")
print("="*60)

# ============================================================
# PATHS
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models', 'corn_model.keras')

MODEL_PATH = os.path.join(MODELS_DIR, 'corn_model_final.h5')
CONFIG_PATH = os.path.join(MODELS_DIR, 'config.json')
LABELS_PATH = os.path.join(MODELS_DIR, 'class_labels.json')

print(f"\n📁 Checking files...")
print(f"   Model exists : {os.path.exists(MODEL_PATH)}")
print(f"   Config exists: {os.path.exists(CONFIG_PATH)}")
print(f"   Labels exists: {os.path.exists(LABELS_PATH)}")

# ============================================================
# LOAD CONFIGURATION
# ============================================================
print(f"\n📋 Loading configuration...")

# Load class labels
with open(LABELS_PATH, 'r', encoding='utf-8') as f:
    CLASS_LABELS = json.load(f)

print(f"   Number of classes: {len(CLASS_LABELS)}")
print(f"   Class labels:")
for i, label in enumerate(CLASS_LABELS):
    print(f"      [{i:2d}] {label}")

# Load config
with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
    config = json.load(f)
    
print(f"\n   Config contents:")
for key, value in config.items():
    print(f"      {key}: {value}")

IMG_SIZE = config.get('img_size', 224)
NUM_CLASSES = len(CLASS_LABELS)

# ============================================================
# LOAD MODEL
# ============================================================
print(f"\n🤖 Loading model...")

try:
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    print(f"   ✅ Model loaded successfully")
except Exception as e:
    print(f"   ❌ Error: {e}")
    exit(1)

# ============================================================
# INSPECT MODEL ARCHITECTURE
# ============================================================
print(f"\n🏗️  Model Architecture:")
print(f"   Name: {model.name}")
print(f"   Input shape : {model.input_shape}")
print(f"   Output shape: {model.output_shape}")
print(f"\n   Layers ({len(model.layers)} total):")

for i, layer in enumerate(model.layers):
    if i < 5 or i >= len(model.layers) - 10:  # Show first 5 and last 10
        print(f"      [{i:3d}] {layer.name:30s} | {layer.__class__.__name__:20s} | Output: {layer.output_shape}")
    elif i == 5:
        print(f"      ... ({len(model.layers) - 15} more layers) ...")

# ============================================================
# TEST PREPROCESSING
# ============================================================
print(f"\n🔬 Testing Preprocessing...")

# Create test image
test_image = Image.new('RGB', (IMG_SIZE, IMG_SIZE), color=(128, 128, 128))
test_array = np.array(test_image, dtype=np.float32)

print(f"\n   Original image:")
print(f"      Shape: {test_array.shape}")
print(f"      Dtype: {test_array.dtype}")
print(f"      Range: [{test_array.min()}, {test_array.max()}]")

# Method 1: Your current preprocessing (divide by 255)
preprocessed_wrong = test_array / 255.0
preprocessed_wrong = np.expand_dims(preprocessed_wrong, axis=0)

print(f"\n   Preprocessing Method 1 (WRONG - divide by 255):")
print(f"      Shape: {preprocessed_wrong.shape}")
print(f"      Range: [{preprocessed_wrong.min():.3f}, {preprocessed_wrong.max():.3f}]")

# Method 2: MobileNetV2 preprocessing (CORRECT)
preprocessed_correct = tf.keras.applications.mobilenet_v2.preprocess_input(test_array)
preprocessed_correct = np.expand_dims(preprocessed_correct, axis=0)

print(f"\n   Preprocessing Method 2 (CORRECT - MobileNetV2):")
print(f"      Shape: {preprocessed_correct.shape}")
print(f"      Range: [{preprocessed_correct.min():.3f}, {preprocessed_correct.max():.3f}]")

# Method 3: Manual formula
manual_preprocess = (test_array / 127.5) - 1.0
manual_preprocess = np.expand_dims(manual_preprocess, axis=0)

print(f"\n   Preprocessing Method 3 (Manual formula):")
print(f"      Shape: {manual_preprocess.shape}")
print(f"      Range: [{manual_preprocess.min():.3f}, {manual_preprocess.max():.3f}]")

# Verify they're the same
print(f"\n   Verification:")
print(f"      Method 2 == Method 3: {np.allclose(preprocessed_correct, manual_preprocess)}")

# ============================================================
# TEST PREDICTION WITH DIFFERENT PREPROCESSING
# ============================================================
print(f"\n🧪 Testing Predictions with Different Preprocessing...")

print(f"\n   Using WRONG preprocessing (divide by 255):")
pred_wrong = model.predict(preprocessed_wrong, verbose=0)
top_wrong = np.argmax(pred_wrong[0])
print(f"      Predicted class: [{top_wrong}] {CLASS_LABELS[top_wrong]}")
print(f"      Confidence: {pred_wrong[0][top_wrong]*100:.2f}%")
print(f"      Top 3:")
top3_wrong = np.argsort(pred_wrong[0])[::-1][:3]
for idx in top3_wrong:
    print(f"         [{idx:2d}] {CLASS_LABELS[idx]:30s} : {pred_wrong[0][idx]*100:.2f}%")

print(f"\n   Using CORRECT preprocessing (MobileNetV2):")
pred_correct = model.predict(preprocessed_correct, verbose=0)
top_correct = np.argmax(pred_correct[0])
print(f"      Predicted class: [{top_correct}] {CLASS_LABELS[top_correct]}")
print(f"      Confidence: {pred_correct[0][top_correct]*100:.2f}%")
print(f"      Top 3:")
top3_correct = np.argsort(pred_correct[0])[::-1][:3]
for idx in top3_correct:
    print(f"         [{idx:2d}] {CLASS_LABELS[idx]:30s} : {pred_correct[0][idx]*100:.2f}%")

# ============================================================
# CHECK IF THEY'RE DIFFERENT
# ============================================================
print(f"\n📊 Comparison:")
print(f"   Predictions are different: {top_wrong != top_correct}")
print(f"   Prediction difference magnitude: {np.abs(pred_wrong - pred_correct).max():.4f}")

# ============================================================
# SUMMARY
# ============================================================
print(f"\n{'='*60}")
print(f"📝 SUMMARY")
print(f"{'='*60}")
print(f"✅ Model loaded: {model is not None}")
print(f"✅ Expected classes: {NUM_CLASSES}")
print(f"✅ Actual output classes: {model.output_shape[-1]}")
print(f"✅ Classes match: {NUM_CLASSES == model.output_shape[-1]}")
print(f"\n⚠️  CRITICAL:")
print(f"   - Training used: MobileNetV2 preprocessing (range [-1, 1])")
print(f"   - You MUST use: tf.keras.applications.mobilenet_v2.preprocess_input()")
print(f"   - DO NOT use: image / 255.0")
print(f"{'='*60}\n")