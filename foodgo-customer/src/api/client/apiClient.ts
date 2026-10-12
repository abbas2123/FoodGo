import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from './apiConfig';
import { SecureStorage } from '../../services/storage/secureStorage';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Isolated Axios instance specifically for auth refresh & logout requests.
 * By omitting interceptors here, we prevent recursive interceptor loops.
 */
export const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Callbacks for notifying Redux of refreshed tokens or complete auth failure
type TokenUpdateCallback = (tokens: { accessToken: string; refreshToken: string }) => void;
type AuthFailureCallback = () => void;

let onTokenUpdateCallback: TokenUpdateCallback | null = null;
let onAuthFailureCallback: AuthFailureCallback | null = null;

export const setAuthCallbacks = (callbacks: {
  onTokenUpdate?: TokenUpdateCallback;
  onAuthFailure?: AuthFailureCallback;
}) => {
  if (callbacks.onTokenUpdate) onTokenUpdateCallback = callbacks.onTokenUpdate;
  if (callbacks.onAuthFailure) onAuthFailureCallback = callbacks.onAuthFailure;
};

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const accessToken = await SecureStorage.getAccessToken();
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch (err) {
      if (__DEV__) console.warn('Failed to retrieve access token for request:', err);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Mutex / single-flight promise to handle concurrent 401s gracefully
let refreshPromise: Promise<string> | null = null;

async function executeTokenRefresh(): Promise<string> {
  try {
    const refreshToken = await SecureStorage.getRefreshToken();
    if (!refreshToken) {
      if (__DEV__) console.warn('[Auth] No refresh token found during token refresh');
      throw new Error('No refresh token available');
    }

    if (__DEV__) console.log('[Auth] Refreshing tokens via refreshClient...');

    const response = await refreshClient.post<
      ApiResponse<{
        tokens: { accessToken: string; refreshToken: string };
        user?: unknown;
      }>
    >(API_ENDPOINTS.AUTH.REFRESH_TOKEN, { refreshToken });

    const tokens = response.data?.data?.tokens;
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new Error('Invalid token response structure from refresh endpoint');
    }

    // 1. Save new rotated tokens to SecureStorage exclusively
    await SecureStorage.setTokens(tokens.accessToken, tokens.refreshToken);

    // 2. Synchronize Redux store state
    if (onTokenUpdateCallback) {
      onTokenUpdateCallback(tokens);
    }

    if (__DEV__) console.log('[Auth] Token refresh successful and state synchronized');
    return tokens.accessToken;
  } catch (err: any) {
    const status = err?.response?.status;
    // Only wipe tokens and trigger logout if server explicitly rejected the refresh token (401 or 403)
    // or if there is simply no refresh token available in storage.
    // Do NOT wipe tokens on transient network errors (timeouts, offline, 5xx server errors).
    const isAuthRejection = status === 401 || status === 403 || err?.message === 'No refresh token available';

    if (isAuthRejection) {
      if (__DEV__) console.warn('[Auth] Refresh token rejected or unavailable. Clearing session.');
      await SecureStorage.clearTokens();
      if (onAuthFailureCallback) {
        onAuthFailureCallback();
      }
    } else {
      if (__DEV__) console.warn('[Auth] Network or server error during token refresh. Retaining tokens.');
    }
    throw err;
  } finally {
    refreshPromise = null;
  }
}

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & {
      _retry?: boolean;
    }) | undefined;

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/email/send-otp') ||
      originalRequest?.url?.includes('/auth/email/verify-otp') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/logout');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = executeTokenRefresh();
        }
        const newAccessToken = await refreshPromise;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    const customMessage =
      error.response?.data?.message ||
      (Array.isArray(error.response?.data?.message)
        ? (error.response?.data?.message as string[]).join(', ')
        : null) ||
      error.message ||
      'An unexpected network error occurred.';

    return Promise.reject(new Error(customMessage));
  },
);

export default apiClient;
