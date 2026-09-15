import { apiClient, ApiResponse } from "../client/apiClient";
import { API_ENDPOINTS } from "../client/apiConfig";

export interface Address {
  id: string;
  user_id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | string;
  longitude: number | string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressDto {
  label: string;
  address_line1: string;
  address_line2?: string;
  landmark?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  latitude: number | string;
  longitude: number | string;
  is_default?: boolean;
}

export interface UpdateAddressDto {
  label?: string;
  address_line1?: string;
  address_line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  latitude?: number | string;
  longitude?: number | string;
  is_default?: boolean;
}

export interface DeleteAddressResponse {
  deletedId: string;
  newDefaultId?: string | null;
}

export const addressApi = {
  getAddresses: async (): Promise<ApiResponse<Address[]>> => {
    const response = await apiClient.get<ApiResponse<Address[]>>(
      API_ENDPOINTS.ADDRESS.METHODS,
    );
    return response.data;
  },

  createAddress: async (
    dto: CreateAddressDto,
  ): Promise<ApiResponse<Address>> => {
    const response = await apiClient.post<ApiResponse<Address>>(
      API_ENDPOINTS.ADDRESS.METHODS,
      dto,
    );
    return response.data;
  },

  updateAddress: async (
    id: string,
    dto: UpdateAddressDto,
  ): Promise<ApiResponse<Address>> => {
    const response = await apiClient.patch<ApiResponse<Address>>(
      API_ENDPOINTS.ADDRESS.BY_ID(id),
      dto,
    );
    return response.data;
  },

  deleteAddress: async (
    id: string,
  ): Promise<ApiResponse<DeleteAddressResponse>> => {
    const response = await apiClient.delete<ApiResponse<DeleteAddressResponse>>(
      API_ENDPOINTS.ADDRESS.BY_ID(id),
    );
    return response.data;
  },

  setDefaultAddress: async (id: string): Promise<ApiResponse<Address>> => {
    const response = await apiClient.patch<ApiResponse<Address>>(
      API_ENDPOINTS.ADDRESS.SET_DEFAULT(id),
    );
    return response.data;
  },
};
