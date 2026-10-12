import { apiClient, refreshClient, ApiResponse } from '../client/apiClient';
import { API_ENDPOINTS } from '../client/apiConfig';

export interface UserDto {
  id: string;
  email: string;
  phone?: string | null;
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
  /** Request an email OTP to be sent to the provided address. */
  async sendOtp(email: string): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      API_ENDPOINTS.AUTH.SEND_OTP,
      { email },
    );
    return response.data;
  },

  /** Verify the OTP for the given email address. */
  async verifyOtp(email: string, otp: string): Promise<ApiResponse<VerifyOtpResponseData>> {
    const response = await apiClient.post<ApiResponse<VerifyOtpResponseData>>(
      API_ENDPOINTS.AUTH.VERIFY_OTP,
      { email, otp },
    );
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<ApiResponse<RefreshTokenResponseData>> {
    const response = await refreshClient.post<ApiResponse<RefreshTokenResponseData>>(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      { refreshToken },
    );
    return response.data;
  },

  async logout(refreshToken: string): Promise<ApiResponse<null>> {
    const response = await refreshClient.post<ApiResponse<null>>(
      API_ENDPOINTS.AUTH.LOGOUT,
      { refreshToken },
    );
    return response.data;
  },
};

export default authApi;
