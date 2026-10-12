import { configureStore } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  createTransform,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import type { PersistConfig } from "redux-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import rootReducer, { RootReducerState } from "./rootReducer";
import type { AuthState } from "./slices/authSlice";

/**
 * Security: Strip JWT tokens from the persisted auth snapshot.
 * Access/refresh tokens are stored exclusively in expo-secure-store (encrypted).
 * Session restoration is handled by restoreSessionThunk via SecureStore on app launch.
 * This prevents token leakage via AsyncStorage on rooted/jailbroken devices.
 */
const authTransform = createTransform<AuthState, AuthState>(
  // on write (state → storage): remove tokens before persisting to AsyncStorage
  (inboundState) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accessToken, refreshToken, ...safeState } = inboundState;
    return { ...safeState, accessToken: null, refreshToken: null };
  },
  // on read (storage → state): tokens are null; restoreSessionThunk fetches from SecureStore
  (outboundState) => outboundState,
  { whitelist: ["auth"] },
);

const persistConfig: PersistConfig<RootReducerState> = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["auth", "location", "theme", "address"],
  transforms: [authTransform],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);


export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

// Synchronize Redux store when tokens are refreshed or revoked via apiClient
import { setAuthCallbacks } from "../api/client/apiClient";
import { setTokens, logOut } from "./slices/authSlice";

setAuthCallbacks({
  onTokenUpdate: (tokens) => {
    store.dispatch(setTokens(tokens));
  },
  onAuthFailure: () => {
    store.dispatch(logOut());
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
