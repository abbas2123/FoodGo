import React, { createContext, useContext } from "react";

/**
 * Provides the name of the deepest currently active route.
 * Populated by App.tsx via NavigationContainer's onStateChange + ref.
 * Consumed by Layout.tsx to make visibility decisions (e.g. hide GlobalCartBar).
 */
const NavigationRouteContext = createContext<string>("Home");

export const NavigationRouteProvider = NavigationRouteContext.Provider;

export function useActiveRouteName(): string {
  return useContext(NavigationRouteContext);
}
