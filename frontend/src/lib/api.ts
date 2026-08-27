import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "./auth";

const rawBase = import.meta.env.VITE_API_URL || "";
export const API_BASE_URL = rawBase ? `${rawBase.replace(/\/+$/, "")}/api/v1` : "/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    const access: string = res.data.access_token;
    const nextRefresh: string = res.data.refresh_token ?? refreshToken;
    setTokens(access, nextRefresh);
    return access;
  } catch {
    logout();
    return null;
  }
}

// Handle 401 by refreshing the token and retrying once
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const isAuthEndpoint =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/register") ||
      original?.url?.includes("/auth/refresh");

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const newToken = await refreshPromise;
      refreshPromise = null;

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    const data = error.response?.data as
      | { error?: { message?: string }; detail?: string | { msg?: string }[]; message?: string }
      | undefined;

    let message: string | undefined = data?.error?.message;
    if (!message && typeof data?.detail === "string") {
      message = data.detail;
    } else if (!message && Array.isArray(data?.detail) && data.detail[0]?.msg) {
      message = data.detail[0].msg;
    } else if (!message && data?.message) {
      message = data.message;
    }

    return Promise.reject(new Error(message || error.message || "An unexpected error occurred"));
  }
);

export default api;
