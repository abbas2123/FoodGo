import { Platform } from "react-native";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Platform.select({
    android: "http://10.0.2.2:3000",
    ios: "http://localhost:3000",
    default: "http://localhost:3000",
  });

export const API_ENDPOINTS = {
  AUTH: {
    SEND_OTP: "/auth/phone/send-otp",
    VERIFY_OTP: "/auth/phone/verify-otp",
    REFRESH_TOKEN: "/auth/refresh",
    LOGOUT: "/auth/logout",
  },
  LOCATION: {
    REVERSE_GEOCODE: "/location/reverse-geocode",
    AUTOCOMPLETE: "/location/autocomplete",
    PLACE_DETAILS: "/location/place-details",
  },
  USER: {
    PROFILE: "/profile",
  },
  PAYMENTS: {
    METHODS: "/payments/methods",
  },
  ADDRESS: {
    METHODS: "/Address",
    BY_ID: (id: string) => `/Address/${id}`,
    SET_DEFAULT: (id: string) => `/Address/${id}/default`,
  },
  RESTAURANTS: {
    LIST: "/restaurants",
    BY_ID: (id: string | number) => `/restaurants/${id}`,
    POPULAR_DISHES: "/restaurants/popular-dishes",
    SEARCH: "/restaurants/search",
  },
  CATEGORIES: {
    LIST: "/categories",
  },
  FAVORITES: {
    LIST: "/favorites",
    TOGGLE: (id: string | number) => `/favorites/${id}`,
    STATUS: (id: string | number) => `/favorites/${id}/status`,
  },
  CART: {
    GET: "/cart",
    ADD_ITEM: "/cart/items",
    UPDATE_ITEM: (id: string | number) => `/cart/items/${id}`,
    REMOVE_ITEM: (id: string | number) => `/cart/items/${id}`,
    CLEAR: "/cart",
  },
  ORDERS: {
    LIST: "/orders",
    BY_ID: (id: string | number) => `/orders/${id}`,
    PLACE: "/orders",
    CANCEL: (id: string | number) => `/orders/${id}/cancel`,
    REVIEW: (id: string | number) => `/orders/${id}/review`,
    REORDER: (id: string | number) => `/orders/${id}/reorder`,
    TRACKING: (id: string | number) => `/orders/${id}/tracking`,
  },
  HEALTH: "/health",
};
