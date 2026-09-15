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

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const accessToken = await SecureStorage.getAccessToken();
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch (err) {
      console.warn('Failed to retrieve access token for request:', err);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/phone/send-otp') ||
      originalRequest?.url?.includes('/auth/phone/verify-otp') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStorage.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const refreshResponse = await axios.post<
          ApiResponse<{
            tokens: { accessToken: string; refreshToken: string };
          }>
        >(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH_TOKEN}`, {
          refreshToken,
        });

        const newTokens = refreshResponse.data?.data?.tokens;
        if (newTokens?.accessToken && newTokens?.refreshToken) {
          await SecureStorage.setTokens(
            newTokens.accessToken,
            newTokens.refreshToken,
          );

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          }

          processQueue(null, newTokens.accessToken);
          return apiClient(originalRequest);
        } else {
          throw new Error('Invalid token response from refresh endpoint');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await SecureStorage.clearTokens();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
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
