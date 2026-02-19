import axios from "axios";

function resolveBackendBaseUrl() {
  const envUrl = process.env.REACT_APP_BACKEND_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const runtimeUrl = window.__APP_CONFIG__?.BACKEND_URL?.trim();
    if (runtimeUrl) {
      return runtimeUrl.replace(/\/+$/, "");
    }

    const { protocol, hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8001";
    }

    return origin;
  }

  return "http://localhost:8001";
}

const BACKEND_BASE_URL = resolveBackendBaseUrl();

const api = axios.create({
  baseURL: `${BACKEND_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pwp_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("pwp_token");
      localStorage.removeItem("pwp_user");
      if (
        !window.location.pathname.startsWith("/play") &&
        window.location.pathname !== "/login"
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
