import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  addressApi,
  Address,
  CreateAddressDto,
  UpdateAddressDto,
} from "@/api/address/addressApi";
import type { RootState } from "../index";

export interface AddressState {
  addresses: Address[];
  selectedAddressId: string | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

const initialState: AddressState = {
  addresses: [],
  selectedAddressId: null,
  loading: false,
  error: null,
  initialized: false,
};

export const fetchAddresses = createAsyncThunk<
  Address[],
  void,
  { rejectValue: string }
>("address/fetchAddresses", async (_, { rejectWithValue }) => {
  try {
    const response = await addressApi.getAddresses();
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load addresses",
    );
  }
});

export const addAddress = createAsyncThunk<
  Address,
  CreateAddressDto,
  { rejectValue: string }
>("address/addAddress", async (dto, { rejectWithValue }) => {
  try {
    const response = await addressApi.createAddress(dto);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to save address",
    );
  }
});

export const updateAddress = createAsyncThunk<
  Address,
  { id: string; dto: UpdateAddressDto },
  { rejectValue: string }
>("address/updateAddress", async ({ id, dto }, { rejectWithValue }) => {
  try {
    const response = await addressApi.updateAddress(id, dto);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to update address",
    );
  }
});

export const deleteAddress = createAsyncThunk<
  { deletedId: string; newDefaultId?: string | null },
  string,
  { rejectValue: string }
>("address/deleteAddress", async (id, { rejectWithValue }) => {
  try {
    const response = await addressApi.deleteAddress(id);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to delete address",
    );
  }
});

export const setDefaultAddress = createAsyncThunk<
  Address,
  string,
  { rejectValue: string }
>("address/setDefaultAddress", async (id, { rejectWithValue }) => {
  try {
    const response = await addressApi.setDefaultAddress(id);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to set default address",
    );
  }
});

const addressSlice = createSlice({
  name: "address",
  initialState,
  reducers: {
    selectAddress: (state, action: PayloadAction<string | null>) => {
      state.selectedAddressId = action.payload;
    },
    clearAddressError: (state) => {
      state.error = null;
    },
    resetAddresses: () => initialState,
  },
  extraReducers: (builder) => {
    // fetchAddresses
    builder
      .addCase(fetchAddresses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAddresses.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.addresses = action.payload;
        // If current selectedAddressId is no longer valid, clear it
        if (
          state.selectedAddressId &&
          !action.payload.some((a) => a.id === state.selectedAddressId)
        ) {
          state.selectedAddressId = null;
        }
      })
      .addCase(fetchAddresses.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = action.payload || "Failed to load addresses";
      });

    // addAddress
    builder
      .addCase(addAddress.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addAddress.fulfilled, (state, action) => {
        state.loading = false;
        const newAddress = action.payload;
        if (newAddress.is_default) {
          state.addresses = state.addresses.map((a) => ({
            ...a,
            is_default: false,
          }));
        }
        state.addresses.unshift(newAddress);
        // Automatically select the newly created address
        state.selectedAddressId = newAddress.id;
      })
      .addCase(addAddress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to save address";
      });

    // updateAddress
    builder
      .addCase(updateAddress.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAddress.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        state.addresses = state.addresses.map((addr) => {
          if (addr.id === updated.id) {
            return updated;
          }
          if (updated.is_default) {
            return { ...addr, is_default: false };
          }
          return addr;
        });
      })
      .addCase(updateAddress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to update address";
      });

    // deleteAddress
    builder
      .addCase(deleteAddress.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteAddress.fulfilled, (state, action) => {
        state.loading = false;
        const { deletedId, newDefaultId } = action.payload;
        state.addresses = state.addresses.filter((a) => a.id !== deletedId);

        if (newDefaultId) {
          state.addresses = state.addresses.map((a) =>
            a.id === newDefaultId ? { ...a, is_default: true } : a,
          );
        }

        if (state.selectedAddressId === deletedId) {
          state.selectedAddressId = newDefaultId || null;
        }
      })
      .addCase(deleteAddress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to delete address";
      });

    // setDefaultAddress
    builder
      .addCase(setDefaultAddress.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(setDefaultAddress.fulfilled, (state, action) => {
        state.loading = false;
        const defaultAddr = action.payload;
        state.addresses = state.addresses.map((a) => ({
          ...a,
          is_default: a.id === defaultAddr.id,
        }));
        state.selectedAddressId = defaultAddr.id;
      })
      .addCase(setDefaultAddress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to set default address";
      });
  },
});

export const { selectAddress, clearAddressError, resetAddresses } =
  addressSlice.actions;

export const selectAllAddresses = (state: RootState): Address[] =>
  state.address?.addresses ?? [];

export const selectAddressLoading = (state: RootState): boolean =>
  state.address?.loading ?? false;

export const selectAddressError = (state: RootState): string | null =>
  state.address?.error ?? null;

export const selectAddressInitialized = (state: RootState): boolean =>
  state.address?.initialized ?? false;

export const selectDefaultAddress = (state: RootState): Address | null => {
  const addresses = state.address?.addresses ?? [];
  return addresses.find((a) => a.is_default) ?? addresses[0] ?? null;
};

export const selectSelectedAddress = (state: RootState): Address | null => {
  const addressState = state.address;
  if (!addressState) return null;

  const { addresses, selectedAddressId } = addressState;
  if (selectedAddressId) {
    const found = addresses.find((a) => a.id === selectedAddressId);
    if (found) return found;
  }

  const defaultAddr = addresses.find((a) => a.is_default);
  if (defaultAddr) return defaultAddr;

  if (addresses.length > 0) return addresses[0];

  return null;
};

export default addressSlice.reducer;
