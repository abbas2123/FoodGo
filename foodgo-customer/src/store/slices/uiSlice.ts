import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UiState {
  selectedCategory: string;
  searchQuery: string;
  notificationCount: number;
  notificationsEnabled: boolean;
}

const initialState: UiState = {
  selectedCategory: 'All',
  searchQuery: '',
  notificationCount: 2,
  notificationsEnabled: true,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedCategory: (state, action: PayloadAction<string>) => {
      state.selectedCategory = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    clearSearchQuery: (state) => {
      state.searchQuery = '';
    },
    setNotificationCount: (state, action: PayloadAction<number>) => {
      state.notificationCount = action.payload;
    },
    resetFilters: (state) => {
      state.selectedCategory = 'All';
      state.searchQuery = '';
    },
    toggleNotifications: (state) => {
      state.notificationsEnabled = !state.notificationsEnabled;
    },
  },
});

export const {
  setSelectedCategory,
  setSearchQuery,
  clearSearchQuery,
  setNotificationCount,
  resetFilters,
  toggleNotifications,
} = uiSlice.actions;

export default uiSlice.reducer;
