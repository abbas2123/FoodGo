import { apiClient, ApiResponse } from "../client/apiClient";
import { API_ENDPOINTS } from "../client/apiConfig";

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  profileImageUrl: string | null;
  type: string;
  status: string;
  phone: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileDto {
  name?: string;
  email?: string;
  profileImageUrl?: string;
}
import {
  addressApi,
  Address,
  CreateAddressDto,
  UpdateAddressDto,
} from "../address/addressApi";

export type { Address, CreateAddressDto, UpdateAddressDto };
export { addressApi };

export const usersApi = {
  getProfile: async (): Promise<ApiResponse<UserProfile>> => {
    const response = await apiClient.get<ApiResponse<UserProfile>>(
      API_ENDPOINTS.USER.PROFILE,
    );
    return response.data;
  },

  updateProfile: async (
    dto: UpdateProfileDto,
  ): Promise<ApiResponse<UserProfile>> => {
    const response = await apiClient.patch<ApiResponse<UserProfile>>(
      API_ENDPOINTS.USER.PROFILE,
      dto,
    );
    return response.data;
  },

  getAddresses: addressApi.getAddresses,
  createAddress: addressApi.createAddress,
  updateAddress: addressApi.updateAddress,
  deleteAddress: addressApi.deleteAddress,
  setDefaultAddress: addressApi.setDefaultAddress,
};
