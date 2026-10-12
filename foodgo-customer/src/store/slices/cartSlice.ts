import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  cartApi,
  BackendCart,
  BackendCartBill,
} from "@/api/cart/cartApi";
import { logoutThunk } from "./authSlice";

export interface CartItem {
  id: string; // CartItem id or menuItemId fallback
  menuItemId?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  restaurantId?: string;
  specialInstructions?: string;
}

export interface CartState {
  items: CartItem[];
  totalCount: number;
  totalAmount: number;
  restaurantId: string | null;
  restaurantName: string | null;
  restaurantImage: string | null;
  bill: BackendCartBill | null;
  loading: boolean;
  error: string | null;
  pendingMutations: number;
  latestMutationSeq: number;
}

const initialState: CartState = {
  items: [],
  totalCount: 0,
  totalAmount: 0,
  restaurantId: null,
  restaurantName: null,
  restaurantImage: null,
  bill: null,
  loading: false,
  error: null,
  pendingMutations: 0,
  latestMutationSeq: 0,
};

let mutationSeqCounter = 0;

const calculateTotals = (items: CartItem[]) => {
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  return {
    totalCount,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
};

function mapBackendCartToItems(cart: BackendCart): CartItem[] {
  return (cart.items || []).map((ci) => ({
    id: ci.id,
    menuItemId: ci.menuItemId,
    name: ci.name,
    price: ci.price,
    quantity: ci.quantity,
    image: ci.image,
    restaurantId: ci.restaurantId,
    specialInstructions: ci.specialInstructions ?? undefined,
  }));
}

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export type BackendCartWithSeq = BackendCart & { _seq?: number };

export const fetchCart = createAsyncThunk<
  BackendCart,
  void,
  { rejectValue: string }
>("cart/fetchCart", async (_, { rejectWithValue }) => {
  try {
    const response = await cartApi.getCart();
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message || error?.message || "Failed to load cart",
    );
  }
});

export const addCartItemServer = createAsyncThunk<
  BackendCartWithSeq,
  { menuItemId: number; quantity?: number; specialInstructions?: string },
  { rejectValue: string }
>("cart/addItem", async (payload, { rejectWithValue }) => {
  const seq = ++mutationSeqCounter;
  try {
    const response = await cartApi.addItem({
      menuItemId: payload.menuItemId,
      quantity: payload.quantity || 1,
      specialInstructions: payload.specialInstructions,
    });
    return { ...response.data, _seq: seq };
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message || error?.message || "Failed to add to cart",
    );
  }
});

export const updateCartItemQuantityServer = createAsyncThunk<
  BackendCartWithSeq,
  { cartItemId: string | number; quantity: number },
  { rejectValue: string }
>("cart/updateQuantity", async ({ cartItemId, quantity }, { rejectWithValue }) => {
  const seq = ++mutationSeqCounter;
  try {
    const response = await cartApi.updateQuantity(cartItemId, quantity);
    return { ...response.data, _seq: seq };
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to update quantity",
    );
  }
});

export const removeCartItemServer = createAsyncThunk<
  BackendCartWithSeq,
  string | number,
  { rejectValue: string }
>("cart/removeItem", async (cartItemId, { rejectWithValue }) => {
  const seq = ++mutationSeqCounter;
  try {
    const response = await cartApi.removeItem(cartItemId);
    return { ...response.data, _seq: seq };
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to remove item",
    );
  }
});

export const clearCartServer = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>("cart/clearCart", async (_, { rejectWithValue }) => {
  try {
    await cartApi.clearCart();
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message || error?.message || "Failed to clear cart",
    );
  }
});

// ─── Slice ───────────────────────────────────────────────────────────────────

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (
      state,
      action: PayloadAction<{
        id: string;
        name: string;
        price: number;
        image?: string;
        restaurantId?: string;
        quantity?: number;
      }>,
    ) => {
      const quantityToAdd = action.payload.quantity || 1;
      const targetId = String(action.payload.id);
      const existingItemIndex = state.items.findIndex(
        (item) =>
          String(item.id) === targetId ||
          String(item.menuItemId) === targetId,
      );

      if (existingItemIndex > -1) {
        state.items[existingItemIndex].quantity += quantityToAdd;
      } else {
        state.items.push({
          id: targetId,
          menuItemId: targetId,
          name: action.payload.name,
          price: action.payload.price,
          quantity: quantityToAdd,
          image: action.payload.image,
          restaurantId: action.payload.restaurantId,
        });
      }

      if (action.payload.restaurantId) {
        state.restaurantId = action.payload.restaurantId;
      }

      const totals = calculateTotals(state.items);
      state.totalCount = totals.totalCount;
      state.totalAmount = totals.totalAmount;
    },

    removeFromCart: (state, action: PayloadAction<string>) => {
      const targetId = String(action.payload);
      state.items = state.items.filter(
        (item) =>
          String(item.id) !== targetId &&
          String(item.menuItemId) !== targetId,
      );
      if (state.items.length === 0) {
        state.restaurantId = null;
        state.restaurantName = null;
        state.restaurantImage = null;
        state.bill = null;
      }
      const totals = calculateTotals(state.items);
      state.totalCount = totals.totalCount;
      state.totalAmount = totals.totalAmount;
    },

    decrementQuantity: (state, action: PayloadAction<string>) => {
      const targetId = String(action.payload);
      const index = state.items.findIndex(
        (item) =>
          String(item.id) === targetId ||
          String(item.menuItemId) === targetId,
      );
      if (index > -1) {
        if (state.items[index].quantity > 1) {
          state.items[index].quantity -= 1;
        } else {
          state.items.splice(index, 1);
        }
      }
      if (state.items.length === 0) {
        state.restaurantId = null;
        state.restaurantName = null;
        state.restaurantImage = null;
        state.bill = null;
      }
      const totals = calculateTotals(state.items);
      state.totalCount = totals.totalCount;
      state.totalAmount = totals.totalAmount;
    },

    updateQuantity: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>,
    ) => {
      const targetId = String(action.payload.id);
      const item = state.items.find(
        (i) =>
          String(i.id) === targetId ||
          String(i.menuItemId) === targetId,
      );
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter(
            (i) =>
              String(i.id) !== targetId &&
              String(i.menuItemId) !== targetId,
          );
        } else {
          item.quantity = action.payload.quantity;
        }
      }
      if (state.items.length === 0) {
        state.restaurantId = null;
        state.restaurantName = null;
        state.restaurantImage = null;
        state.bill = null;
      }
      const totals = calculateTotals(state.items);
      state.totalCount = totals.totalCount;
      state.totalAmount = totals.totalAmount;
    },

    clearCart: (state) => {
      state.items = [];
      state.totalCount = 0;
      state.totalAmount = 0;
      state.restaurantId = null;
      state.restaurantName = null;
      state.restaurantImage = null;
      state.bill = null;
      state.error = null;
      state.pendingMutations = 0;
    },
  },
  extraReducers: (builder) => {
    // Pending mutation incrementers
    builder
      .addCase(addCartItemServer.pending, (state) => {
        state.pendingMutations = (state.pendingMutations || 0) + 1;
        state.error = null;
      })
      .addCase(updateCartItemQuantityServer.pending, (state) => {
        state.pendingMutations = (state.pendingMutations || 0) + 1;
        state.error = null;
      })
      .addCase(removeCartItemServer.pending, (state) => {
        state.pendingMutations = (state.pendingMutations || 0) + 1;
        state.error = null;
      });

    // Rejection handlers
    builder
      .addCase(addCartItemServer.rejected, (state, action) => {
        state.pendingMutations = Math.max(0, (state.pendingMutations || 1) - 1);
        state.error = action.payload ?? "Failed to add to cart";
      })
      .addCase(updateCartItemQuantityServer.rejected, (state, action) => {
        state.pendingMutations = Math.max(0, (state.pendingMutations || 1) - 1);
        state.error = action.payload ?? "Failed to update quantity";
      })
      .addCase(removeCartItemServer.rejected, (state, action) => {
        state.pendingMutations = Math.max(0, (state.pendingMutations || 1) - 1);
        state.error = action.payload ?? "Failed to remove item";
      });

    // Fulfilled handlers for mutations
    const handleMutationFulfilled = (
      state: CartState,
      action: PayloadAction<BackendCartWithSeq>,
    ) => {
      state.loading = false;
      state.error = null;
      state.pendingMutations = Math.max(0, (state.pendingMutations || 1) - 1);

      const cart = action.payload;
      const serverItems = mapBackendCartToItems(cart);

      if (state.pendingMutations === 0) {
        // No other mutations in-flight: server state is authoritative
        state.items = serverItems;
        state.restaurantId = cart.restaurantId;
        state.restaurantName = cart.restaurantName;
        state.restaurantImage = cart.restaurantImage;
        state.bill = cart.bill;
      } else {
        // Other mutations still in-flight: merge server result with optimistic local items.
        // Server items win for items that exist on the server; preserve local-only items.
        const merged = [...serverItems];
        for (const localItem of state.items) {
          const exists = serverItems.some(
            (si) =>
              String(si.id) === String(localItem.id) ||
              String(si.menuItemId) === String(localItem.menuItemId),
          );
          if (!exists) {
            merged.push(localItem);
          }
        }
        state.items = merged;
        state.restaurantId = cart.restaurantId || state.restaurantId;
        state.restaurantName = cart.restaurantName || state.restaurantName;
        state.restaurantImage = cart.restaurantImage || state.restaurantImage;
      }
      const totals = calculateTotals(state.items);
      state.totalCount = totals.totalCount;
      state.totalAmount = totals.totalAmount;
    };

    builder
      .addCase(addCartItemServer.fulfilled, handleMutationFulfilled)
      .addCase(updateCartItemQuantityServer.fulfilled, handleMutationFulfilled)
      .addCase(removeCartItemServer.fulfilled, handleMutationFulfilled);

    // ─── fetchCart ────────────────────────────────────────────────────────────
    // CRITICAL FIX: fetchCart must NOT overwrite Redux state when there are
    // pending mutations in-flight (pendingMutations > 0). Doing so causes the
    // race condition where:
    //
    //   T1: User adds Product A (optimistic addToCart + addCartItemServer pending)
    //   T2: User adds Product B (optimistic addToCart + addCartItemServer pending)
    //   T3: User taps "View Cart" → CartModal opens → fetchCart() dispatched
    //   T4: fetchCart resolves: server only has Product A (B not persisted yet)
    //   T5: [BUG] Old code: state.items = serverItems → Product B silently disappears
    //
    // Fix: if pendingMutations > 0, discard the fetchCart response entirely.
    //      The pending mutations' own fulfilled handlers will reconcile the final state.
    //      This preserves the optimistic local state until all mutations settle.
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false;

        // Guard: discard stale fetch results when mutations are still in-flight.
        if (state.pendingMutations > 0) {
          return;
        }

        const cart = action.payload;
        state.items = mapBackendCartToItems(cart);
        state.restaurantId = cart.restaurantId;
        state.restaurantName = cart.restaurantName;
        state.restaurantImage = cart.restaurantImage;
        state.bill = cart.bill;
        // NOTE: Do NOT reset pendingMutations here — mutations own their own counter.
        const totals = calculateTotals(state.items);
        state.totalCount = totals.totalCount;
        state.totalAmount = totals.totalAmount;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load cart";
      });

    // Clear cart server
    builder.addCase(clearCartServer.fulfilled, (state) => {
      state.items = [];
      state.totalCount = 0;
      state.totalAmount = 0;
      state.restaurantId = null;
      state.restaurantName = null;
      state.restaurantImage = null;
      state.bill = null;
      state.pendingMutations = 0;
    });

    // Logout
    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.items = [];
      state.totalCount = 0;
      state.totalAmount = 0;
      state.restaurantId = null;
      state.restaurantName = null;
      state.restaurantImage = null;
      state.bill = null;
      state.error = null;
      state.pendingMutations = 0;
      state.latestMutationSeq = 0;
    });
  },
});

export const {
  addToCart,
  removeFromCart,
  decrementQuantity,
  updateQuantity,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;
