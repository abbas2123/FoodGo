import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  FavoriteItem,
  favoritesApi,
} from "@/api/favorites/favoritesApi";

export interface FavoritesState {
  items: FavoriteItem[];
  statusMap: Record<string, boolean>;
  loading: boolean;
  togglingId: string | null;
  error: string | null;
}

const initialState: FavoritesState = {
  items: [],
  statusMap: {},
  loading: false,
  togglingId: null,
  error: null,
};

export const fetchFavorites = createAsyncThunk<
  FavoriteItem[],
  void,
  { rejectValue: string }
>("favorites/fetchFavorites", async (_, { rejectWithValue }) => {
  try {
    const response = await favoritesApi.getFavorites();
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load favorites",
    );
  }
});

export const addFavorite = createAsyncThunk<
  FavoriteItem,
  string | number,
  { rejectValue: string }
>("favorites/addFavorite", async (restaurantId, { rejectWithValue }) => {
  try {
    const response = await favoritesApi.addFavorite(restaurantId);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to add favorite",
    );
  }
});

export const removeFavorite = createAsyncThunk<
  string,
  string | number,
  { rejectValue: string }
>("favorites/removeFavorite", async (restaurantId, { rejectWithValue }) => {
  try {
    await favoritesApi.removeFavorite(restaurantId);
    return restaurantId.toString();
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to remove favorite",
    );
  }
});

export const checkFavoriteStatus = createAsyncThunk<
  { restaurantId: string; isFavorite: boolean },
  string | number,
  { rejectValue: string }
>("favorites/checkStatus", async (restaurantId, { rejectWithValue }) => {
  try {
    const response = await favoritesApi.getFavoriteStatus(restaurantId);
    return {
      restaurantId: restaurantId.toString(),
      isFavorite: response.data.isFavorite,
    };
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to check favorite status",
    );
  }
});

export const favoritesSlice = createSlice({
  name: "favorites",
  initialState,
  reducers: {
    setFavoriteStatus: (
      state,
      action: PayloadAction<{ restaurantId: string; isFavorite: boolean }>,
    ) => {
      state.statusMap[action.payload.restaurantId] = action.payload.isFavorite;
    },
  },
  extraReducers: (builder) => {
    // Fetch favorites
    builder
      .addCase(fetchFavorites.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFavorites.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        // Populate status map
        action.payload.forEach((item) => {
          if (item.restaurant?.id) {
            state.statusMap[item.restaurant.id] = true;
          }
        });
      })
      .addCase(fetchFavorites.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load favorites";
      });

    // Add favorite
    builder
      .addCase(addFavorite.pending, (state, action) => {
        const rId = action.meta.arg.toString();
        state.togglingId = rId;
        state.statusMap[rId] = true;
      })
      .addCase(addFavorite.fulfilled, (state, action) => {
        state.togglingId = null;
        const newItem = action.payload;
        if (newItem && !state.items.some((i) => i.id === newItem.id)) {
          state.items.unshift(newItem);
        }
        if (newItem?.restaurant?.id) {
          state.statusMap[newItem.restaurant.id] = true;
        }
      })
      .addCase(addFavorite.rejected, (state, action) => {
        state.togglingId = null;
        const rId = action.meta.arg.toString();
        state.statusMap[rId] = false;
        state.error = action.payload ?? "Failed to add favorite";
      });

    // Remove favorite
    builder
      .addCase(removeFavorite.pending, (state, action) => {
        const rId = action.meta.arg.toString();
        state.togglingId = rId;
        state.statusMap[rId] = false;
      })
      .addCase(removeFavorite.fulfilled, (state, action) => {
        state.togglingId = null;
        const rId = action.payload;
        state.items = state.items.filter((item) => item.restaurant?.id !== rId);
        state.statusMap[rId] = false;
      })
      .addCase(removeFavorite.rejected, (state, action) => {
        state.togglingId = null;
        const rId = action.meta.arg.toString();
        state.statusMap[rId] = true;
        state.error = action.payload ?? "Failed to remove favorite";
      });

    // Check status
    builder.addCase(checkFavoriteStatus.fulfilled, (state, action) => {
      state.statusMap[action.payload.restaurantId] = action.payload.isFavorite;
    });
  },
});

export const { setFavoriteStatus } = favoritesSlice.actions;
export default favoritesSlice.reducer;
