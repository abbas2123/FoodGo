import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  ordersApi,
  PlaceOrderPayload,
} from "@/api/orders/ordersApi";
import { Order } from "@/types/order.types";

export interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  trackingData: any | null;
  loading: boolean;
  placingOrder: boolean;
  cancellingOrder: boolean;
  reviewSubmitting: boolean;
  reorderLoading: boolean;
  trackingLoading: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  orders: [],
  currentOrder: null,
  trackingData: null,
  loading: false,
  placingOrder: false,
  cancellingOrder: false,
  reviewSubmitting: false,
  reorderLoading: false,
  trackingLoading: false,
  error: null,
};

export const fetchOrders = createAsyncThunk<
  Order[],
  void,
  { rejectValue: string }
>("orders/fetchOrders", async (_, { rejectWithValue }) => {
  try {
    const response = await ordersApi.getOrders();
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load orders",
    );
  }
});

export const fetchOrderById = createAsyncThunk<
  Order,
  string | number,
  { rejectValue: string }
>("orders/fetchOrderById", async (id, { rejectWithValue }) => {
  try {
    const response = await ordersApi.getOrderById(id);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load order details",
    );
  }
});

export const placeOrder = createAsyncThunk<
  Order,
  PlaceOrderPayload,
  { rejectValue: string }
>("orders/placeOrder", async (payload, { rejectWithValue }) => {
  try {
    const response = await ordersApi.placeOrder(payload);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to place order",
    );
  }
});

export const cancelOrder = createAsyncThunk<
  Order,
  string | number,
  { rejectValue: string }
>("orders/cancelOrder", async (id, { rejectWithValue }) => {
  try {
    const response = await ordersApi.cancelOrder(id);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to cancel order",
    );
  }
});

export const submitOrderReview = createAsyncThunk<
  { id: string; orderId: string; rating: number; comment: string | null },
  { orderId: string | number; rating: number; comment?: string },
  { rejectValue: string }
>("orders/submitReview", async ({ orderId, rating, comment }, { rejectWithValue }) => {
  try {
    const response = await ordersApi.submitReview(orderId, rating, comment);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to submit review",
    );
  }
});

export const reorderPastOrder = createAsyncThunk<
  {
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
  },
  string | number,
  { rejectValue: string }
>("orders/reorder", async (orderId, { rejectWithValue }) => {
  try {
    const response = await ordersApi.reorder(orderId);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to reorder",
    );
  }
});

export const fetchOrderTracking = createAsyncThunk<
  any,
  string | number,
  { rejectValue: string }
>("orders/fetchTracking", async (orderId, { rejectWithValue }) => {
  try {
    const response = await ordersApi.getOrderTracking(orderId);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load tracking info",
    );
  }
});

export const ordersSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    clearCurrentOrder: (state) => {
      state.currentOrder = null;
      state.error = null;
    },
    setCurrentOrder: (state, action: PayloadAction<Order | null>) => {
      state.currentOrder = action.payload;
    },
    clearTrackingData: (state) => {
      state.trackingData = null;
      state.trackingLoading = false;
    },
  },
  extraReducers: (builder) => {
    // Fetch orders
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load orders";
      });

    // Fetch order by id
    builder
      .addCase(fetchOrderById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentOrder = action.payload;
        const idx = state.orders.findIndex((o) => o.id === action.payload.id);
        if (idx >= 0) {
          state.orders[idx] = action.payload;
        }
      })
      .addCase(fetchOrderById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load order details";
      });

    // Place order
    builder
      .addCase(placeOrder.pending, (state) => {
        state.placingOrder = true;
        state.error = null;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.placingOrder = false;
        state.currentOrder = action.payload;
        state.orders.unshift(action.payload);
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.placingOrder = false;
        state.error = action.payload ?? "Failed to place order";
      });

    // Cancel order
    builder
      .addCase(cancelOrder.pending, (state) => {
        state.cancellingOrder = true;
        state.error = null;
      })
      .addCase(cancelOrder.fulfilled, (state, action) => {
        state.cancellingOrder = false;
        state.currentOrder = action.payload;
        const idx = state.orders.findIndex((o) => o.id === action.payload.id);
        if (idx >= 0) {
          state.orders[idx] = action.payload;
        }
      })
      .addCase(cancelOrder.rejected, (state, action) => {
        state.cancellingOrder = false;
        state.error = action.payload ?? "Failed to cancel order";
      });

    // Submit review
    builder
      .addCase(submitOrderReview.pending, (state) => {
        state.reviewSubmitting = true;
      })
      .addCase(submitOrderReview.fulfilled, (state, action) => {
        state.reviewSubmitting = false;
        if (state.currentOrder && state.currentOrder.id === action.payload.orderId) {
          state.currentOrder.userRating = action.payload.rating;
          state.currentOrder.userComment = action.payload.comment || undefined;
        }
        const idx = state.orders.findIndex((o) => o.id === action.payload.orderId);
        if (idx >= 0) {
          state.orders[idx].userRating = action.payload.rating;
          state.orders[idx].userComment = action.payload.comment || undefined;
        }
      })
      .addCase(submitOrderReview.rejected, (state, action) => {
        state.reviewSubmitting = false;
        state.error = action.payload ?? "Failed to submit review";
      });

    // Reorder
    builder
      .addCase(reorderPastOrder.pending, (state) => {
        state.reorderLoading = true;
      })
      .addCase(reorderPastOrder.fulfilled, (state) => {
        state.reorderLoading = false;
      })
      .addCase(reorderPastOrder.rejected, (state, action) => {
        state.reorderLoading = false;
        state.error = action.payload ?? "Failed to reorder";
      });

    // Tracking
    builder
      .addCase(fetchOrderTracking.pending, (state) => {
        state.trackingLoading = true;
      })
      .addCase(fetchOrderTracking.fulfilled, (state, action) => {
        state.trackingLoading = false;
        state.trackingData = action.payload;
      })
      .addCase(fetchOrderTracking.rejected, (state) => {
        state.trackingLoading = false;
      });
  },
});

export const { clearCurrentOrder, setCurrentOrder, clearTrackingData } =
  ordersSlice.actions;
export default ordersSlice.reducer;

