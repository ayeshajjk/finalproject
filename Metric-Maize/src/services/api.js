import { Platform } from "react-native";

const ANDROID_IP = "192.168.1.12";
const API_PORT = 5000;

const getApiUrl = () => {
  if (Platform.OS === "web") return "http://localhost:5000";
  return `http://${ANDROID_IP}:${API_PORT}`;
};

const API_URL = getApiUrl();
console.log(`🌐 Using API URL: ${API_URL} (Platform: ${Platform.OS})`);

export const getApiInfo = async () => {
  try {
    const res = await fetch(`${API_URL}/info`);
    return await res.json();
  } catch (e) {
    console.warn("Ignoring /info error:", e?.message);
    return null;
  }
};

export const classifyMaize = async (imageUrl, base64Data = null) => {
  console.log("classifyMaize called with:", imageUrl ? imageUrl.substring(0, 80) : "null");
  console.log("base64Data provided:", base64Data ? `${base64Data.length} chars` : "null");

  let body;

  if (base64Data) {
    // ✅ BEST PATH: Send raw base64 directly to Python backend
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    console.log(`📤 Sending base64 (${cleanBase64.length} chars) to backend...`);
    body = { image_base64: cleanBase64 };
  } else if (imageUrl) {
    // Fallback: send URL if base64 not provided
    console.log("📤 Sending image URL to backend...");
    body = { image_url: imageUrl };
  } else {
    throw new Error('No image data provided to classifyMaize');
  }

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