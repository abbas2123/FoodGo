import { apiClient, ApiResponse } from '../client/apiClient';
import { API_ENDPOINTS } from '../client/apiConfig';

export interface UserDto {
  id: string;
  phone: string;
  name: string | null;
  type: string;
  status: string;
}

export interface TokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface VerifyOtpResponseData {
  user: UserDto;
  tokens: TokensDto;
}

export interface RefreshTokenResponseData {
  tokens: TokensDto;
  user: UserDto;
}

export const authApi = {
  async sendOtp(phone: string): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      API_ENDPOINTS.AUTH.SEND_OTP,
      { phone },
    );
    return response.data;
  },

  async verifyOtp(phone: string, otp: string): Promise<ApiResponse<VerifyOtpResponseData>> {
    const response = await apiClient.post<ApiResponse<VerifyOtpResponseData>>(
      API_ENDPOINTS.AUTH.VERIFY_OTP,
      { phone, otp },
    );
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<ApiResponse<RefreshTokenResponseData>> {
    const response = await apiClient.post<ApiResponse<RefreshTokenResponseData>>(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      { refreshToken },
    );
    return response.data;
  },

  async logout(refreshToken: string): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      API_ENDPOINTS.AUTH.LOGOUT,
      { refreshToken },
    );
    return response.data;
  },
};

export default authApi;
