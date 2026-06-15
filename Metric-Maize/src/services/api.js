import { Platform } from "react-native";

// const ANDROID_IP = "192.168.1.12";
// const API_PORT = 5000;

// const getApiUrl = () => {
//   if (Platform.OS === "web") return "http://localhost:5000";
//   return `http://${ANDROID_IP}:${API_PORT}`;
// };

// AFTER — paste your Render URL here (no trailing slash, keep the https)
// yaha pr render wala URL dal dyna and upper wala comment kr dyna
const API_URL = "https://matric-maize.onrender.com";

const getApiUrl = () => API_URL;


const API_URL = getApiUrl();
console.log(`🌐 Using API URL: ${API_URL} (Platform: ${Platform.OS})`);

export const getApiInfo = async () => {
  try {
    const res = await fetch(`${API_URL}/status`);
    return await res.json();
  } catch (e) {
    console.warn("Ignoring /info error:", e?.message);
    return null;
  }
};

export const classifyMaize = async (imageUrl, base64Data = null) => {
  console.log("classifyMaize called with:", imageUrl ? imageUrl.substring(0, 80) : "null");
  console.log("base64Data provided:", base64Data ? `${base64Data.length} chars` : "null");

  // ✅ Send BOTH the image URL and the base64 string together (whichever we have).
  //    - image_url    → current backend downloads & classifies this (primary path)
  //    - image_base64 → sent alongside as a fallback for base64-capable backends
  const body = {};

  if (imageUrl) {
    body.image_url = imageUrl;
  }

  if (base64Data) {
    // Strip any "data:image/...;base64," prefix the web sometimes adds.
    body.image_base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  }

  if (!body.image_url && !body.image_base64) {
    throw new Error('No image data provided to classifyMaize (need image_url or base64).');
  }

  console.log("📤 Sending to backend →", {
    image_url: body.image_url ? `${body.image_url.substring(0, 60)}...` : null,
    image_base64: body.image_base64 ? `${body.image_base64.length} chars` : null,
  });

  const response = await fetch(`${API_URL}/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error || `Server error ${response.status}`);
  }

  const data = await response.json();
  console.log("Classification result:", data);
  return data;
};

export const predictDisease = classifyMaize;