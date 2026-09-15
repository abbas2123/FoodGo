import { apiClient, ApiResponse } from "../client/apiClient";
import { API_ENDPOINTS } from "../client/apiConfig";
import { RestaurantListItem } from "../restaurants/restaurantsApi";

export interface FavoriteItem {
  id: string;
  savedAt: string;
  restaurant: RestaurantListItem;
}

export interface FavoriteStatusResponse {
  isFavorite: boolean;
}

export const favoritesApi = {
  getFavorites: async (): Promise<ApiResponse<FavoriteItem[]>> => {
    const response = await apiClient.get<ApiResponse<FavoriteItem[]>>(
      API_ENDPOINTS.FAVORITES.LIST,
    );
    return response.data;
  },

  addFavorite: async (
    restaurantId: string | number,
  ): Promise<ApiResponse<FavoriteItem>> => {
    const response = await apiClient.post<ApiResponse<FavoriteItem>>(
      API_ENDPOINTS.FAVORITES.TOGGLE(restaurantId),
    );
    return response.data;
  },

  removeFavorite: async (
    restaurantId: string | number,
  ): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      API_ENDPOINTS.FAVORITES.TOGGLE(restaurantId),
    );
    return response.data;
  },

  getFavoriteStatus: async (
    restaurantId: string | number,
  ): Promise<ApiResponse<FavoriteStatusResponse>> => {
    const response = await apiClient.get<ApiResponse<FavoriteStatusResponse>>(
      API_ENDPOINTS.FAVORITES.STATUS(restaurantId),
    );
    return response.data;
  },
};
