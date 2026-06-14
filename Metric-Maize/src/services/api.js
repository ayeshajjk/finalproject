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

export const classifyMaize = async (imageUrl) => {
  console.log("classifyMaize called with:", imageUrl);

  let response;

  if (Platform.OS === "web") {
    // Web: send file
    const formData = new FormData();
    const fileResponse = await fetch(imageUrl);
    const blob = await fileResponse.blob();
    formData.append("image", blob, "maize.jpg");

    response = await fetch(`${API_URL}/classify`, {
      method: "POST",
      body: formData,
    });
  } else {
    // ✅ Android: send URL as JSON
    response = await fetch(`${API_URL}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl }),
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error || `Server error ${response.status}`);
  }

  const data = await response.json();
  console.log("Classification result:", data);
  return data;
};

export const predictDisease = classifyMaize;