import { apiClient, ApiResponse } from "../client/apiClient";
import { API_ENDPOINTS } from "../client/apiConfig";
import { CategoryItem, DishItem } from "@/features/home/types";
import { RestaurantData } from "@/features/restaurants/types";

export interface RestaurantListItem {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviewCount: string;
  deliveryTime: string;
  deliveryFee: string;
  image: string;
  isOpen: boolean;
  offer: string | null;
  distance: string;
}

export interface SearchDishItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  isVeg: boolean;
  isBestseller: boolean;
  category: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImage: string;
  restaurantIsOpen: boolean;
}

export interface SearchResults {
  restaurants: RestaurantListItem[];
  dishes: SearchDishItem[];
}

export const restaurantsApi = {
  getCategories: async (): Promise<ApiResponse<CategoryItem[]>> => {
    const response = await apiClient.get<ApiResponse<CategoryItem[]>>(
      API_ENDPOINTS.CATEGORIES.LIST,
    );
    return response.data;
  },

  getRestaurants: async (
    category?: string,
  ): Promise<ApiResponse<RestaurantListItem[]>> => {
    const response = await apiClient.get<ApiResponse<RestaurantListItem[]>>(
      API_ENDPOINTS.RESTAURANTS.LIST,
      {
        params: category && category !== "All" ? { category } : undefined,
      },
    );
    return response.data;
  },

  getPopularDishes: async (): Promise<ApiResponse<DishItem[]>> => {
    const response = await apiClient.get<ApiResponse<DishItem[]>>(
      API_ENDPOINTS.RESTAURANTS.POPULAR_DISHES,
    );
    return response.data;
  },

  getRestaurantById: async (
    id: string | number,
  ): Promise<ApiResponse<RestaurantData>> => {
    const response = await apiClient.get<ApiResponse<RestaurantData>>(
      API_ENDPOINTS.RESTAURANTS.BY_ID(id),
    );
    return response.data;
  },

  search: async (q: string): Promise<ApiResponse<SearchResults>> => {
    const response = await apiClient.get<ApiResponse<SearchResults>>(
      API_ENDPOINTS.RESTAURANTS.SEARCH,
      {
        params: { q },
      },
    );
    return response.data;
  },
};

