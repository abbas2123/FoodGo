import { Platform } from "react-native";

function isPrivateOrLocalHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "10.0.2.2" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local")
    ) {
      return true;
    }

    // IPv4 private ranges:
    // 10.0.0.0/8
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }
    // 192.168.0.0/16
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!__DEV__) {
    if (!envUrl) {
      throw new Error(
        "[Config Error] EXPO_PUBLIC_API_URL must be defined for production builds (e.g., https://api.foodigo.app).",
      );
    }
    if (!envUrl.startsWith("https://")) {
      throw new Error(
        "[Config Error] Production API URL must use HTTPS protocol.",
      );
    }
    if (isPrivateOrLocalHost(envUrl)) {
      throw new Error(
        `[Config Error] Release builds cannot use localhost or private LAN address (${envUrl}). Configure a valid public HTTPS API domain.`,
      );
    }
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }

  if (envUrl) {
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }

  return Platform.select({
    android: "http://10.0.2.2:3000",
    ios: "http://localhost:3000",
    default: "http://localhost:3000",
  });
}

export const API_BASE_URL = getApiBaseUrl();
export const API_ENDPOINTS = {
  AUTH: {
    SEND_OTP: "/auth/email/send-otp",
    VERIFY_OTP: "/auth/email/verify-otp",
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
    METHODS: '/payments/methods',
    CREATE_ORDER: '/payments/create-order',
    VERIFY: '/payments/verify',
    FAILURE: '/payments/failure',
    ORDER_PAYMENTS: (orderId: string | number) => `/payments/order/${orderId}`,
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
    CHECKOUT: "/orders/checkout",
    CANCEL: (id: string | number) => `/orders/${id}/cancel`,
    REVIEW: (id: string | number) => `/orders/${id}/review`,
    REORDER: (id: string | number) => `/orders/${id}/reorder`,
    TRACKING: (id: string | number) => `/orders/${id}/tracking`,
  },
  NOTIFICATIONS: {
    LIST: "/notifications",
    MARK_READ: (id: string | number) => `/notifications/${id}/read`,
    MARK_ALL_READ: "/notifications/read-all",
    DELETE: (id: string | number) => `/notifications/${id}`,
    CLEAR_ALL: "/notifications",
  },
  SEARCH: {
    RECENT: "/search/recent",
    DELETE_RECENT: (id: string | number) => `/search/recent/${id}`,
    CLEAR_RECENT: "/search/recent",
  },
  HEALTH: "/health",
};
