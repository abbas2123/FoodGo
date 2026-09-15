import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  restaurantId?: string;
}

export interface CartState {
  items: CartItem[];
  totalCount: number;
  totalAmount: number;
}

const initialState: CartState = {
  items: [],
  totalCount: 0,
  totalAmount: 0,
};

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
      console.log("state:", state, "action:", action);
      const quantityToAdd = action.payload.quantity || 1;
      const existingItemIndex = state.items.findIndex(
        (item) => item.id === action.payload.id,
      );

      if (existingItemIndex > -1) {
        state.items[existingItemIndex].quantity += quantityToAdd;
      } else {
        state.items.push({
          id: action.payload.id,
          name: action.payload.name,
          price: action.payload.price,
          quantity: quantityToAdd,
          image: action.payload.image,
          restaurantId: action.payload.restaurantId,
        });
      }

      const totals = calculateTotals(state.items);
      state.totalCount = totals.totalCount;
      state.totalAmount = totals.totalAmount;
    },

    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
      const totals = calculateTotals(state.items);
      state.totalCount = totals.totalCount;
      state.totalAmount = totals.totalAmount;
    },

    decrementQuantity: (state, action: PayloadAction<string>) => {
      const index = state.items.findIndex((item) => item.id === action.payload);
      if (index > -1) {
        if (state.items[index].quantity > 1) {
          state.items[index].quantity -= 1;
        } else {
          state.items.splice(index, 1);
        }
      }
      const totals = calculateTotals(state.items);
      state.totalCount = totals.totalCount;
      state.totalAmount = totals.totalAmount;
    },

    updateQuantity: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>,
    ) => {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter((i) => i.id !== action.payload.id);
        } else {
          item.quantity = action.payload.quantity;
        }
      }
      const totals = calculateTotals(state.items);
      state.totalCount = totals.totalCount;
      state.totalAmount = totals.totalAmount;
    },

    clearCart: (state) => {
      state.items = [];
      state.totalCount = 0;
      state.totalAmount = 0;
    },
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
