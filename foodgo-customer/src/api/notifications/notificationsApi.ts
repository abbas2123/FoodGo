import { apiClient, ApiResponse } from "../client/apiClient";
import { API_ENDPOINTS } from "../client/apiConfig";

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: "ORDER_UPDATE" | "PROMO" | "DELIVERY" | "SYSTEM" | string;
  isRead: boolean;
  orderId: number | null;
  createdAt: string;
}

export interface NotificationsResponseData {
  notifications: AppNotification[];
  unreadCount: number;
}

export const notificationsApi = {
  getNotifications: async (): Promise<ApiResponse<NotificationsResponseData>> => {
    const response = await apiClient.get<ApiResponse<NotificationsResponseData>>(
      API_ENDPOINTS.NOTIFICATIONS.LIST,
    );
    return response.data;
  },

  markAsRead: async (id: number): Promise<ApiResponse<AppNotification>> => {
    const response = await apiClient.patch<ApiResponse<AppNotification>>(
      API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id),
    );
    return response.data;
  },

  markAllAsRead: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.patch<ApiResponse<null>>(
      API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ,
    );
    return response.data;
  },

  deleteNotification: async (id: number): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      API_ENDPOINTS.NOTIFICATIONS.DELETE(id),
    );
    return response.data;
  },

  clearAll: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      API_ENDPOINTS.NOTIFICATIONS.CLEAR_ALL,
    );
    return response.data;
  },
};
