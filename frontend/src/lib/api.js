import axios from "axios";

const BACKEND_URL_STORAGE_KEY = "pwp_backend_url";

function normalizeUrl(url) {
  return url?.trim()?.replace(/\/+$/, "");
}

function readRuntimeBackendUrl() {
  if (typeof window === "undefined") return "";

  const fromQuery = new URLSearchParams(window.location.search).get("backend_url");
  if (fromQuery) {
    const normalized = normalizeUrl(fromQuery);
    if (normalized) {
      localStorage.setItem(BACKEND_URL_STORAGE_KEY, normalized);
      return normalized;
    }
  }

  const fromStorage = normalizeUrl(localStorage.getItem(BACKEND_URL_STORAGE_KEY));
  if (fromStorage) {
    return fromStorage;
  }

  const fromWindowConfig = normalizeUrl(window.__APP_CONFIG__?.BACKEND_URL);
  if (fromWindowConfig) {
    return fromWindowConfig;
  }

  return "";
}

function resolveBackendBaseUrl() {
  const envUrl = normalizeUrl(process.env.REACT_APP_BACKEND_URL);
  if (envUrl) {
    return envUrl;
  }

  const runtimeUrl = readRuntimeBackendUrl();
  if (runtimeUrl) {
    return runtimeUrl;
  }

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8001";
    }
    return origin;
  }

  return "http://localhost:8001";
}

export const BACKEND_BASE_URL = resolveBackendBaseUrl();

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
