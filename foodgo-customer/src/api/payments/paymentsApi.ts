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

export interface CreatePaymentOrderDto {
  orderId: number;
}

export interface PaymentOrderData {
  transactionId: string;
  orderId: number;
  orderNumber: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentDto {
  orderId: number;
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}

export interface VerifyPaymentData {
  orderId: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  transactionId: string;
  paidAt?: string;
}

export interface PaymentFailureDto {
  orderId: number;
  providerOrderId: string;
  code?: string;
  description?: string;
}

export interface OrderPaymentTransactionItem {
  id: string;
  orderId: number;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  createdAt: string;
  paidAt?: string;
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

  createPaymentOrder: async (
    dto: CreatePaymentOrderDto,
  ): Promise<ApiResponse<PaymentOrderData>> => {
    const response = await apiClient.post<ApiResponse<PaymentOrderData>>(
      API_ENDPOINTS.PAYMENTS.CREATE_ORDER,
      dto,
    );
    return response.data;
  },

  verifyPayment: async (
    dto: VerifyPaymentDto,
  ): Promise<ApiResponse<VerifyPaymentData>> => {
    const response = await apiClient.post<ApiResponse<VerifyPaymentData>>(
      API_ENDPOINTS.PAYMENTS.VERIFY,
      dto,
    );
    return response.data;
  },

  recordPaymentFailure: async (
    dto: PaymentFailureDto,
  ): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      API_ENDPOINTS.PAYMENTS.FAILURE,
      dto,
    );
    return response.data;
  },

  getOrderPayments: async (
    orderId: string | number,
  ): Promise<ApiResponse<OrderPaymentTransactionItem[]>> => {
    const response = await apiClient.get<ApiResponse<OrderPaymentTransactionItem[]>>(
      API_ENDPOINTS.PAYMENTS.ORDER_PAYMENTS(orderId),
    );
    return response.data;
  },
};
