import React, { useRef, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import {
  NavigationContainer,
  NavigationContainerRef,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { Provider, useSelector } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PersistGate } from "redux-persist/integration/react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { store, persistor } from "./src/store";
import type { RootState } from "./src/store";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { NavigationRouteProvider } from "./src/navigation/NavigationRouteContext";
import { RootStackParamList } from "./src/navigation/types";

function LoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#C1121F" />
    </View>
  );
}

/**
 * Recursively walks nested navigator state to find the real deepest active route.
 * This is necessary because Checkout is registered inside AppStackParamList, which
 * is itself nested as the "App" screen inside RootStackParamList. Reading state at
 * the root level only ever returns "App" or "Auth", never "Checkout" or "Home".
 * Uses `any` intentionally — React Navigation's PartialState types don't expose
 * a clean recursive type and fighting them adds noise without value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getActiveRouteName(state: any): string {
  if (!state || !state.routes || state.routes.length === 0) return "Home";
  const activeRoute = state.routes[state.index ?? 0];
  if (activeRoute?.state) {
    return getActiveRouteName(activeRoute.state);
  }
  return activeRoute?.name ?? "Home";
}

/**
 * Inner component that reads Redux theme state and passes it to NavigationContainer.
 * Must be rendered inside <Provider> so it can access the store.
 */
function AppWithTheme() {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [activeRouteName, setActiveRouteName] = useState<string>("Home");

  const themeMode = useSelector((state: RootState) => state.theme.mode);
  const isDark = themeMode === "dark";

  // Build a custom light/dark theme aligned to FoodGo's brand red
  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: "#C1121F",
          background: "#121212",
          card: "#1E1E1E",
          text: "#F5F5F5",
          border: "#333333",
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: "#C1121F",
          background: "#FFF9F7",
          card: "#FFFFFF",
          text: "#1F1010",
          border: "#EEEEEE",
        },
      };

  const captureRoute = useCallback(() => {
    const state = navigationRef.current?.getRootState();
    const name = getActiveRouteName(state as any);
    setActiveRouteName(name);
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={captureRoute}
      onStateChange={captureRoute}
    >
      <NavigationRouteProvider value={activeRouteName}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <RootNavigator />
      </NavigationRouteProvider>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<LoadingFallback />} persistor={persistor}>
        <SafeAreaProvider>
          <AppWithTheme />
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF9F7",
  },
});
