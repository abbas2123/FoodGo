import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  restaurantsApi,
  RestaurantListItem,
  SearchResults,
} from "@/api/restaurants/restaurantsApi";
import { CategoryItem, DishItem } from "@/features/home/types";
import { RestaurantData } from "@/features/restaurants/types";

export interface RestaurantsState {
  categories: CategoryItem[];
  restaurants: RestaurantListItem[];
  popularDishes: DishItem[];
  currentRestaurant: RestaurantData | null;
  searchResults: SearchResults | null;
  searchLoading: boolean;
  loading: boolean;
  restaurantDetailLoading: boolean;
  error: string | null;
}

const initialState: RestaurantsState = {
  categories: [],
  restaurants: [],
  popularDishes: [],
  currentRestaurant: null,
  searchResults: null,
  searchLoading: false,
  loading: false,
  restaurantDetailLoading: false,
  error: null,
};

export const fetchCategories = createAsyncThunk<
  CategoryItem[],
  void,
  { rejectValue: string }
>("restaurants/fetchCategories", async (_, { rejectWithValue }) => {
  try {
    const response = await restaurantsApi.getCategories();
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load categories",
    );
  }
});

export const fetchRestaurants = createAsyncThunk<
  RestaurantListItem[],
  string | undefined,
  { rejectValue: string }
>("restaurants/fetchRestaurants", async (category, { rejectWithValue }) => {
  try {
    const response = await restaurantsApi.getRestaurants(category);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load restaurants",
    );
  }
});

export const fetchPopularDishes = createAsyncThunk<
  DishItem[],
  void,
  { rejectValue: string }
>("restaurants/fetchPopularDishes", async (_, { rejectWithValue }) => {
  try {
    const response = await restaurantsApi.getPopularDishes();
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load popular dishes",
    );
  }
});

export const fetchRestaurantById = createAsyncThunk<
  RestaurantData,
  string | number,
  { rejectValue: string }
>("restaurants/fetchRestaurantById", async (id, { rejectWithValue }) => {
  try {
    const response = await restaurantsApi.getRestaurantById(id);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load restaurant details",
    );
  }
});

export const searchRestaurants = createAsyncThunk<
  SearchResults,
  string,
  { rejectValue: string }
>("restaurants/search", async (query, { rejectWithValue }) => {
  try {
    const response = await restaurantsApi.search(query);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to perform search",
    );
  }
});

export const restaurantsSlice = createSlice({
  name: "restaurants",
  initialState,
  reducers: {
    clearCurrentRestaurant: (state) => {
      state.currentRestaurant = null;
      state.restaurantDetailLoading = false;
    },
    clearSearch: (state) => {
      state.searchResults = null;
      state.searchLoading = false;
    },
  },
  extraReducers: (builder) => {
    // Categories
    builder
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to load categories";
      });

    // Restaurants
    builder
      .addCase(fetchRestaurants.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRestaurants.fulfilled, (state, action) => {
        state.loading = false;
        state.restaurants = action.payload;
      })
      .addCase(fetchRestaurants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load restaurants";
      });

    // Popular Dishes
    builder
      .addCase(fetchPopularDishes.fulfilled, (state, action) => {
        state.popularDishes = action.payload;
      })
      .addCase(fetchPopularDishes.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to load popular dishes";
      });

    // Restaurant Detail
    builder
      .addCase(fetchRestaurantById.pending, (state) => {
        state.restaurantDetailLoading = true;
        state.error = null;
      })
      .addCase(fetchRestaurantById.fulfilled, (state, action) => {
        state.restaurantDetailLoading = false;
        state.currentRestaurant = action.payload;
      })
      .addCase(fetchRestaurantById.rejected, (state, action) => {
        state.restaurantDetailLoading = false;
        state.error = action.payload ?? "Failed to load restaurant details";
      });

    // Search
    builder
      .addCase(searchRestaurants.pending, (state) => {
        state.searchLoading = true;
      })
      .addCase(searchRestaurants.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchRestaurants.rejected, (state) => {
        state.searchLoading = false;
        state.searchResults = { restaurants: [], dishes: [] };
      });
  },
});

export const { clearCurrentRestaurant, clearSearch } = restaurantsSlice.actions;
export default restaurantsSlice.reducer;

