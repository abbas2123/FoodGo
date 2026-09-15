import { apiClient, ApiResponse } from "../client/apiClient";
import { API_ENDPOINTS } from "../client/apiConfig";
import { Order } from "@/types/order.types";

export interface PlaceOrderItemPayload {
  menuItemId: number;
  quantity: number;
  specialInstructions?: string;
}

export interface PlaceOrderPayload {
  restaurantId: number;
  deliveryAddressId?: number;
  deliveryAddressText?: string;
  paymentMethod?: string;
  specialInstructions?: string;
  items: PlaceOrderItemPayload[];
}

export function adaptBackendOrder(raw: any): Order {
  const rawAddress = raw.deliveryAddress;
  const addressLine = rawAddress
    ? [rawAddress.addressLine1, rawAddress.addressLine2, rawAddress.city, rawAddress.state, rawAddress.postalCode]
        .filter(Boolean)
        .join(", ")
    : raw.deliveryAddressText || "Delivery Address";

  return {
    id: String(raw.id),
    orderNumber: raw.orderNumber || String(raw.id),
    status: raw.status || "PENDING",
    statusLabel: raw.statusLabel || "Pending Confirmation",
    eta: raw.eta || "25–35 min",
    completedAt: raw.completedAt || undefined,
    restaurant: {
      id: String(raw.restaurant?.id || "1"),
      name: raw.restaurant?.name || "Restaurant",
      cuisine: raw.restaurant?.cuisine || raw.restaurant?.cuisineTypes || "Delicious Food",
      imageUrl: raw.restaurant?.image || raw.restaurant?.imageUrl || "",
      rating: raw.restaurant?.rating ? Number(raw.restaurant.rating) : 4.5,
      location: raw.restaurant?.location,
    },
    items: (raw.items || []).map((item: any) => ({
      id: String(item.id),
      name: item.name,
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      customisation: item.customisation || item.specialInstructions || undefined,
    })),
    bill: {
      subtotal: Number(raw.bill?.subtotal) || 0,
      deliveryFee: Number(raw.bill?.deliveryFee) || 0,
      taxes: Number(raw.bill?.taxAmount ?? raw.bill?.taxes) || 0,
      discount: Number(raw.bill?.discount) || 0,
      grandTotal: Number(raw.bill?.grandTotal) || 0,
      currencySymbol: raw.bill?.currencySymbol || "₹",
    },
    deliveryAddress: {
      label: rawAddress?.label || "Home",
      line1: rawAddress?.line1 || addressLine,
      location: rawAddress?.location,
    },
    payment: {
      method: raw.paymentMethod || "Cash on Delivery",
      isPaid: raw.status === "DELIVERED",
    },
    userRating: raw.userRating ?? null,
    userComment: raw.userComment ?? undefined,
  };
}

export const ordersApi = {
  getOrders: async (): Promise<ApiResponse<Order[]>> => {
    const response = await apiClient.get<ApiResponse<any[]>>(
      API_ENDPOINTS.ORDERS.LIST,
    );
    return {
      ...response.data,
      data: (response.data.data || []).map(adaptBackendOrder),
    };
  },

  getOrderById: async (id: string | number): Promise<ApiResponse<Order>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      API_ENDPOINTS.ORDERS.BY_ID(id),
    );
    return {
      ...response.data,
      data: adaptBackendOrder(response.data.data),
    };
  },

  placeOrder: async (
    payload: PlaceOrderPayload,
  ): Promise<ApiResponse<Order>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      API_ENDPOINTS.ORDERS.PLACE,
      payload,
    );
    return {
      ...response.data,
      data: adaptBackendOrder(response.data.data),
    };
  },

  cancelOrder: async (id: string | number): Promise<ApiResponse<Order>> => {
    const response = await apiClient.patch<ApiResponse<any>>(
      API_ENDPOINTS.ORDERS.CANCEL(id),
    );
    return {
      ...response.data,
      data: adaptBackendOrder(response.data.data),
    };
  },

  submitReview: async (
    id: string | number,
    rating: number,
    comment?: string,
  ): Promise<ApiResponse<{ id: string; orderId: string; rating: number; comment: string | null }>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      API_ENDPOINTS.ORDERS.REVIEW(id),
      { rating, comment },
    );
    return response.data;
  },

  reorder: async (
    id: string | number,
  ): Promise<
    ApiResponse<{
      restaurantId: string;
      restaurantName: string;
      items: {
        id: string;
        name: string;
        price: number;
        image: string;
        quantity: number;
      }[];
      unavailableCount: number;
    }>
  > => {
    const response = await apiClient.post<ApiResponse<any>>(
      API_ENDPOINTS.ORDERS.REORDER(id),
    );
    return response.data;
  },

  getOrderTracking: async (
    id: string | number,
  ): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      API_ENDPOINTS.ORDERS.TRACKING(id),
    );
    return response.data;
  },
};

