# Maize Metric

> **AI-powered maize (corn) variety and quality classification** — point your phone at maize kernels and instantly get the **variety** and a **quality grade** with a confidence score.

Maize Metric is a full-stack mobile application that uses a deep-learning image classifier to identify maize varieties and assess their quality. It pairs a **React Native (Expo)** mobile app with a **Flask + TensorFlow** inference backend, and uses **Supabase** for authentication, image storage, and scan history.

---

## Features

- **Scan with Gallery** — capture maize kernels on an existing photo.
- **AI classification** — identifies the maize **variety** and **quality grade** in seconds.
- **Confidence score & full breakdown** — see the top prediction plus per-class probabilities.
- **Scan history** — every scan is saved and viewable, with real-time updates and delete options.
- **User accounts** — sign up / sign in, profiles, and per-user history (Supabase Auth).
- **Notifications** — optional "scan complete" push notifications.
- **Theming & settings** — light theme UI with profile, help, privacy, terms, and about screens.

---

## What it detects

The model classifies **4 varieties × 3 quality grades = 12 classes**.

| Varieties | Quality Grades |
|---|---|
| Agalwoi White | Hybrid Local White | Popcorn | Redcorn
Good — high quality, no defects , Damaged — physical damage present ,  Impure — contains foreign matter
---

## Architecture

The app and the AI model are **two separate programs** that talk over HTTP:

```
    Mobile App (React Native / Expo)
        │
        │  1. capture / pick image  →  base64
        │  2. upload image to Supabase Storage (for history thumbnail)
        │  3. POST { image_url, image_base64 }
        ▼
     Backend (Flask + TensorFlow)             Supabase
        │  - loads MobileNetV2 model               - Auth (users)
        │  - preprocesses image                    - Storage (scan-images)
        │  - predicts variety + grade              - Database (profiles, scan_history)
        ▼
   { success, prediction, confidence, all_probabilities }
        │
        ▼
   📱App shows Variety / Grade / Confidence  →  saves result to history
```

---

## Tech Stack

**Frontend**
- React Native `0.83` + Expo `~55`
- React Navigation (stack + bottom tabs)
- Supabase JS client (auth, storage, database)
- `expo-camera`, `expo-image-picker`, `expo-notifications`, `expo-linear-gradient`

**Backend**
- Python 3.11
- Flask + Flask-CORS
- TensorFlow / Keras (MobileNetV2 transfer-learning model)
- Pillow + NumPy for image processing
- Gunicorn (production server)

**Infrastructure**
- Supabase — authentication, image storage, history database
- Render — backend hosting (optional)

---

## Project Structure

```
finalproject/
├── backend/                         # Flask + TensorFlow inference API
│   ├── app.py                       # API server (/status, /classify)
│   ├── requirements.txt
│   └── models/
│       ├── class_labels.json        # 12 class names (order matters!)
│       └── corn_model.keras/
│           └── corn_model_final.h5  # trained MobileNetV2 model
│
└── Metric-Maize/                    # React Native (Expo) mobile app
    ├── App.js
    ├── app.json
    └── src/
        ├── config/supabase.js       # Supabase credentials
        ├── contexts/                # Auth & Theme providers
        ├── navigation/AppNavigator.js
        ├── screens/                 # Scan, History, Profile, Auth, etc.
        └── services/api.js          # backend URL is configured here
```

---

## Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **Python 3.11**
- A **Supabase** project (free tier is fine)

### 1. Run the backend

```bash
cd backend
py -3.11 -m pip install -r requirements.txt
py -3.11 app.py
```

Verify it's healthy at **http://localhost:5000/status** — you should see `"model_loaded": true`.

### 2. Configure the backend URL

The app reads the backend address from a **single place**: [`Metric-Maize/src/services/api.js`](Metric-Maize/src/services/api.js).

- For **local testing on a phone**, set `ANDROID_IP` to your computer's LAN IP (run `ipconfig`), and make sure the phone is on the **same Wi-Fi**.
- For a **deployed backend** (see below), point it at your public URL instead.

### 3. Run the app

```bash
cd Metric-Maize
npm install
npx expo start
```

Scan the QR code with **Expo Go** (or a dev build) on your device.

---

## Supabase Setup

The app expects:

- **Auth** — email/password enabled.
- **Storage bucket** — `scan-images` (public read for thumbnails).
- **Tables**
  - `profiles` — `id`, `username`, `email`
  - `scan_history` — `id`, `user_id`, `image_url`, `classification`, `grade`, `confidence`, `created_at`
  - `notification_settings` — per-user notification preferences

Add your project URL and **anon** key in [`Metric-Maize/src/config/supabase.js`](Metric-Maize/src/config/supabase.js).
> Only the **anon** key belongs in the client (it's public by design and guarded by Row-Level Security). Never ship a `service_role` key in the app.

---

## Deploying the Backend (Render)

> **Heads up:** TensorFlow needs ~600 MB–1 GB RAM. Render's free 512 MB instance will likely run out of memory — use an instance with **≥ 2 GB RAM**, or convert the model to **TFLite** to shrink it.

1. Push the repo to GitHub.
2. On Render: **New → Web Service**, connect the repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120`
   - **Environment variable:** `PYTHON_VERSION = 3.11.9`
4. After deploy, open `https://<your-app>.onrender.com/status` to confirm `"model_loaded": true`.
5. Put that URL in [`Metric-Maize/src/services/api.js`](Metric-Maize/src/services/api.js) and rebuild the app.

---

## API Reference

### `GET /status`
Health check.
```json
{ "status": "running", "model_loaded": true, "num_classes": 12 }
```

### `POST /classify`
Classify a maize image. Accepts **either** JSON base64 **or** a multipart file upload.

**Request (JSON):**
```json
{ "image_base64": "<base64 string>", "image_url": "<optional public url>" }
```

**Response:**
```json
{
  "success": true,
  "prediction": "Hybrid_local_white_damaged",
  "confidence": 96.4,
  "all_probabilities": {
    "Hybrid_local_white_damaged": 96.4,
    "Popcorn_good": 1.2
  }
}
```
The app splits `prediction` into a clean **variety** (e.g. *Hybrid Local White*) and **grade** (e.g. *Damaged*).

---

Model Details

- **Architecture:** MobileNetV2 (transfer learning) + dense classification head
- **Input size:** 224 × 224 RGB
- **Preprocessing:** `mobilenet_v2.preprocess_input` (range **−1 to 1** — *not* `/255`)
- **Output:** softmax over 12 classes

To swap in a retrained model, replace `backend/models/corn_model.keras/corn_model_final.h5` and make sure the order of `class_labels.json` matches the class indices used during training.

---

License

This project was built as a final-year project.
