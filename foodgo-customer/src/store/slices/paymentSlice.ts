import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  paymentsApi,
  PaymentMethodItem,
  CreatePaymentMethodDto,
} from '../../api/payments/paymentsApi';

export interface PaymentState {
  items: PaymentMethodItem[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
}

const initialState: PaymentState = {
  items: [],
  loading: false,
  actionLoading: false,
  error: null,
};

export const fetchPaymentMethodsThunk = createAsyncThunk(
  'payments/fetchMethods',
  async (_, { rejectWithValue }) => {
    try {
      const response = await paymentsApi.getPaymentMethods();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load payment methods',
      );
    }
  },
);

export const addPaymentMethodThunk = createAsyncThunk(
  'payments/addMethod',
  async (dto: CreatePaymentMethodDto, { rejectWithValue }) => {
    try {
      const response = await paymentsApi.createPaymentMethod(dto);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to add payment method',
      );
    }
  },
);

export const setDefaultPaymentMethodThunk = createAsyncThunk(
  'payments/setDefaultMethod',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await paymentsApi.setDefaultPaymentMethod(id);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to set default payment method',
      );
    }
  },
);

export const deletePaymentMethodThunk = createAsyncThunk(
  'payments/deleteMethod',
  async (id: string, { rejectWithValue }) => {
    try {
      await paymentsApi.deletePaymentMethod(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to remove payment method',
      );
    }
  },
);

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    clearPaymentError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch
    builder
      .addCase(fetchPaymentMethodsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPaymentMethodsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.error = null;
      })
      .addCase(fetchPaymentMethodsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Add
    builder
      .addCase(addPaymentMethodThunk.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(addPaymentMethodThunk.fulfilled, (state, action) => {
        state.actionLoading = false;
        if (action.payload.isDefault) {
          state.items = state.items.map((m) => ({ ...m, isDefault: false }));
          state.items.unshift(action.payload);
        } else {
          state.items.push(action.payload);
        }
        state.error = null;
      })
      .addCase(addPaymentMethodThunk.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });

    // Set Default
    builder
      .addCase(setDefaultPaymentMethodThunk.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(setDefaultPaymentMethodThunk.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.items = state.items
          .map((m) => ({
            ...m,
            isDefault: m.id === action.payload.id,
          }))
          .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
        state.error = null;
      })
      .addCase(setDefaultPaymentMethodThunk.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });

    // Delete
    builder
      .addCase(deletePaymentMethodThunk.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deletePaymentMethodThunk.fulfilled, (state, action) => {
        state.actionLoading = false;
        const deletedId = action.payload;
        const remaining = state.items.filter((m) => m.id !== deletedId);
        // If the deleted one was default and there are items remaining, make the first one default
        const hadDefault = remaining.some((m) => m.isDefault);
        if (!hadDefault && remaining.length > 0) {
          remaining[0].isDefault = true;
        }
        state.items = remaining;
        state.error = null;
      })
      .addCase(deletePaymentMethodThunk.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearPaymentError } = paymentSlice.actions;
export default paymentSlice.reducer;
