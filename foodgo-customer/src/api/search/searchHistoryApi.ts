import { apiClient, ApiResponse } from "../client/apiClient";
import { API_ENDPOINTS } from "../client/apiConfig";

export interface RecentSearchItem {
  id: number;
  query: string;
  createdAt: string;
}

export const searchHistoryApi = {
  getRecent: async (): Promise<ApiResponse<RecentSearchItem[]>> => {
    const response = await apiClient.get<ApiResponse<RecentSearchItem[]>>(
      API_ENDPOINTS.SEARCH.RECENT,
    );
    return response.data;
  },

  addRecent: async (query: string): Promise<ApiResponse<RecentSearchItem>> => {
    const response = await apiClient.post<ApiResponse<RecentSearchItem>>(
      API_ENDPOINTS.SEARCH.RECENT,
      { query },
    );
    return response.data;
  },

  deleteRecent: async (id: number): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      API_ENDPOINTS.SEARCH.DELETE_RECENT(id),
    );
    return response.data;
  },

  clearRecent: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      API_ENDPOINTS.SEARCH.CLEAR_RECENT,
    );
    return response.data;
  },
};
