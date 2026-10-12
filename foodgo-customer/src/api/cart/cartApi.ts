import { apiClient, ApiResponse } from "../client/apiClient";
import { API_ENDPOINTS } from "../client/apiConfig";

export interface BackendCartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  specialInstructions?: string | null;
  restaurantId: string;
  restaurantName?: string;
  restaurantImage?: string | null;
  deliveryFee?: number;
}

export interface BackendRestaurantCartGroup {
  restaurantId: string;
  restaurantName: string;
  restaurantImage: string | null;
  deliveryFee: number;
  subtotal: number;
  items: BackendCartItem[];
}

export interface BackendCartBill {
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  grandTotal: number;
  currencySymbol: string;
}

export interface BackendCart {
  items: BackendCartItem[];
  restaurantGroups?: BackendRestaurantCartGroup[];
  restaurantId: string | null;
  restaurantName: string | null;
  restaurantImage: string | null;
  bill: BackendCartBill;
}

export interface AddCartItemPayload {
  menuItemId: number;
  quantity: number;
  specialInstructions?: string;
}

export const cartApi = {
  getCart: async (): Promise<ApiResponse<BackendCart>> => {
    const response = await apiClient.get<ApiResponse<BackendCart>>(
      API_ENDPOINTS.CART.GET,
    );
    return response.data;
  },

  addItem: async (
    payload: AddCartItemPayload,
  ): Promise<ApiResponse<BackendCart>> => {
    const response = await apiClient.post<ApiResponse<BackendCart>>(
      API_ENDPOINTS.CART.ADD_ITEM,
      payload,
    );
    return response.data;
  },

  updateQuantity: async (
    cartItemId: string | number,
    quantity: number,
  ): Promise<ApiResponse<BackendCart>> => {
    const response = await apiClient.patch<ApiResponse<BackendCart>>(
      API_ENDPOINTS.CART.UPDATE_ITEM(cartItemId),
      { quantity },
    );
    return response.data;
  },

  removeItem: async (
    cartItemId: string | number,
  ): Promise<ApiResponse<BackendCart>> => {
    const response = await apiClient.delete<ApiResponse<BackendCart>>(
      API_ENDPOINTS.CART.REMOVE_ITEM(cartItemId),
    );
    return response.data;
  },

  clearCart: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      API_ENDPOINTS.CART.CLEAR,
    );
    return response.data;
  },
};
