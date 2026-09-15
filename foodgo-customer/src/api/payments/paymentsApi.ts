import { apiClient, ApiResponse } from '../client/apiClient';
import { API_ENDPOINTS } from '../client/apiConfig';

export type PaymentMethodType =
  | 'UPI'
  | 'CARD'
  | 'COD'
  | 'WALLET'
  | 'NET_BANKING';

export interface PaymentMethodItem {
  id: string;
  userId: string;
  type: PaymentMethodType;
  provider: string;
  maskedIdentifier: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentMethodDto {
  type: PaymentMethodType;
  maskedIdentifier: string;
  provider?: string;
  isDefault?: boolean;
}

export const paymentsApi = {
  getPaymentMethods: async (): Promise<ApiResponse<PaymentMethodItem[]>> => {
    const response = await apiClient.get<ApiResponse<PaymentMethodItem[]>>(
      API_ENDPOINTS.PAYMENTS.METHODS,
    );
    return response.data;
  },

  createPaymentMethod: async (
    dto: CreatePaymentMethodDto,
  ): Promise<ApiResponse<PaymentMethodItem>> => {
    const response = await apiClient.post<ApiResponse<PaymentMethodItem>>(
      API_ENDPOINTS.PAYMENTS.METHODS,
      dto,
    );
    return response.data;
  },

  setDefaultPaymentMethod: async (
    id: string,
  ): Promise<ApiResponse<PaymentMethodItem>> => {
    const response = await apiClient.patch<ApiResponse<PaymentMethodItem>>(
      `${API_ENDPOINTS.PAYMENTS.METHODS}/${id}/default`,
    );
    return response.data;
  },

  deletePaymentMethod: async (
    id: string,
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `${API_ENDPOINTS.PAYMENTS.METHODS}/${id}`,
    );
    return response.data;
  },
};
