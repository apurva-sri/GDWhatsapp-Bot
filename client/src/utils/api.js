// In production, VITE_API_BASE_URL points to Railway backend
// In development, Vite proxy handles /api → localhost:5000
const BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "/api";

const request = async (path, options = {}, token = null) => {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

export const api = {
  get: (path, token) => request(path, { method: "GET" }, token),
  post: (path, body, token) =>
    request(path, { method: "POST", body: JSON.stringify(body) }, token),
  delete: (path, token) => request(path, { method: "DELETE" }, token),
};

export const getMe = (token) => api.get("/auth/me", token);
export const getProfile = (token) => api.get("/user/profile", token);
export const getStats = (token) => api.get("/user/stats", token);
export const getHistory = (token) => api.get("/user/history", token);
export const listFiles = (token) => api.get("/drive/files", token);
export const searchFiles = (token, q) =>
  api.get(`/drive/search?q=${encodeURIComponent(q)}`, token);
export const deleteFile = (token, fileId) =>
  api.delete(`/drive/files/${fileId}`, token);
export const shareFile = (token, fileId, body) =>
  api.post(`/drive/files/${fileId}/share`, body, token);
export const logout = (token) => api.post("/auth/logout", {}, token);
export const deactivateAcc = (token) => api.delete("/user/account", token);

// Google OAuth — redirects to backend which redirects to Google
export const startGoogleOAuth = () => {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  window.location.href = `${base}/api/auth/google`;
};
