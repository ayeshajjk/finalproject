from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
from PIL import Image
import traceback

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

@app.route('/status', methods=['GET'])
def status():
    return jsonify({'status': 'running', 'message': 'Server is alive!'})

@app.route('/classify', methods=['POST'])
def classify():
    print("📥 /classify hit!", flush=True)
    
    data = request.get_json() if request.is_json else None
    
    if data and data.get('image_base64'):
        image_base64 = data['image_base64']
        print(f"📥 Got base64 ({len(image_base64)} chars)", flush=True)
        
        try:
            # Strip prefix
            if ',' in image_base64[:100]:
                image_base64 = image_base64.split(',', 1)[1]
            
            image_bytes = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_bytes))
            print(f"✅ Decoded image: {image.size}", flush=True)
            
            return jsonify({
                'success': True,
                'classification': 'Test Maize',
                'grade': 'good',
                'confidence': 95.5,
                'variety': 'Test Maize',
                'message': 'Base64 upload worked!'
            })
        except Exception as e:
            print(f"❌ Error: {e}", flush=True)
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 400
    
    return jsonify({'success': False, 'error': 'No image_base64 provided'}), 400

if __name__ == '__main__':
    print("="*50, flush=True)
    print("🌽 TEST SERVER STARTING...", flush=True)
    print("📌 Visit: http://localhost:5000/status", flush=True)
    print("="*50, flush=True)
    app.run(host='0.0.0.0', port=5000, debug=False)