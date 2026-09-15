import { combineReducers } from '@reduxjs/toolkit';

import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import locationReducer from './slices/locationSlice';
import uiReducer from './slices/uiSlice';
import themeReducer from './slices/themeSlice';
import paymentReducer from './slices/paymentSlice';
import addressReducer from './slices/addressSlice';
import restaurantsReducer from './slices/restaurantsSlice';
import ordersReducer from './slices/ordersSlice';
import favoritesReducer from './slices/favoritesSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  cart: cartReducer,
  location: locationReducer,
  ui: uiReducer,
  theme: themeReducer,
  payment: paymentReducer,
  address: addressReducer,
  restaurants: restaurantsReducer,
  orders: ordersReducer,
  favorites: favoritesReducer,
});

export type RootReducerState = ReturnType<typeof rootReducer>;
export default rootReducer;
