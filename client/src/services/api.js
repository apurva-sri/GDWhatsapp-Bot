import axios from "axios";

/**
 * Axios instance for DriveBot API
 *
 * Fix Issue 7: Mixed env variable styles.
 * Vite ONLY exposes variables prefixed with VITE_ to the browser.
 * process.env.REACT_APP_* does NOT work in Vite — it's a CRA convention.
 *
 * Correct Vite pattern: import.meta.env.VITE_API_URL
 *
 * Add to client/.env (create this file):
 *   VITE_API_URL=http://localhost:5000
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("drivebot_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Global response handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear and redirect to login
      localStorage.removeItem("drivebot_token");
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);

export default api;
export { BASE_URL };
