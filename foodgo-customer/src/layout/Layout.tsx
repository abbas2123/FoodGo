import React, { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList } from "@/navigation/types";
import { GlobalCartBar } from "@/components/common/GlobalCartBar";
import { useActiveRouteName } from "@/navigation/NavigationRouteContext";
import { useTheme } from "@/theme/useTheme";

type Tab = "home" | "search" | "orders" | "favorites" | "profile";

export default function Layout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const { theme } = useTheme();

  /**
   * WHY NOT useNavigationState here?
   *
   * Layout wraps the AppStack's Stack.Navigator as its {children}.
   * useNavigationState reads state from the NEAREST ANCESTOR navigator
   * (RootNavigator's Stack), which only knows about "App" and "Auth" routes.
   * It can never see "Checkout" because Checkout lives in the child Stack
   * that renders inside Layout's children — context flows DOWN, not up.
   *
   * Solution: App.tsx uses NavigationContainer's ref + onStateChange to
   * recursively walk the full nested state and expose the real deepest
   * active route name via NavigationRouteContext.
   */
  const currentRoute = useActiveRouteName();

  // Screens where the bottom chrome (cart bar + tab bar) should be hidden
  const hideBottomUI =
    currentRoute === "Checkout" ||
    currentRoute === "RestaurantDetails" ||
    currentRoute === "OrderDetails" ||
    currentRoute === "TrackOrderDetails";

  // Screens with full-bleed hero content (which manage their own top insets)
  const isFullBleedRoute = currentRoute === "RestaurantDetails";

  // Keep the active tab indicator in sync.
  // OrderDetails and TrackOrderDetails are children of the Orders flow —
  // the Orders tab should remain highlighted while on those routes.
  useEffect(() => {
    const lower = currentRoute.toLowerCase();
    if (lower === "home") setActiveTab("home");
    else if (lower === "search") setActiveTab("search");
    else if (
      lower === "orders" ||
      lower === "orderdetails" ||
      lower === "trackorderdetails"
    )
      setActiveTab("orders");
    else if (lower === "fav") setActiveTab("favorites");
    else if (lower === "profile") setActiveTab("profile");
  }, [currentRoute]);

  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const handleNavigation = (tab: Tab, screen: keyof AppStackParamList) => {
    setActiveTab(tab);
    navigation.navigate(screen);
  };

  const inactiveIconColor = theme.secondaryText;
  const bottomInset = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Main screen content — receives top safe area exactly once (unless full-bleed) */}
      <View
        style={[
          styles.container,
          { paddingTop: isFullBleedRoute ? 0 : insets.top },
        ]}
      >
        {children}
      </View>

      {/* Global cart bar — hidden on Checkout & RestaurantDetails */}
      {!hideBottomUI && <GlobalCartBar />}

      {/* Bottom Navigation — hidden on Checkout & RestaurantDetails */}
      {!hideBottomUI && (
        <View
          style={[
            styles.layoutContainer,
            {
              backgroundColor: theme.surface,
              borderTopColor: theme.border,
              paddingBottom: bottomInset,
            },
          ]}
        >
          {/* Home */}
          <Pressable
            onPress={() => handleNavigation("home", "Home")}
            style={[
              styles.navItem,
              activeTab === "home" && styles.activeNavItem,
            ]}
          >
            <Ionicons
              name={activeTab === "home" ? "home" : "home-outline"}
              size={28}
              color={activeTab === "home" ? "#FFFFFF" : inactiveIconColor}
            />
          </Pressable>

          {/* Search */}
          <Pressable
            onPress={() => handleNavigation("search", "Search")}
            style={[
              styles.navItem,
              activeTab === "search" && styles.activeNavItem,
            ]}
          >
            <Ionicons
              name="search-outline"
              size={28}
              color={activeTab === "search" ? "#FFFFFF" : inactiveIconColor}
            />
          </Pressable>

          {/* Orders */}
          <Pressable
            onPress={() => handleNavigation("orders", "Orders")}
            style={[
              styles.navItem,
              activeTab === "orders" && styles.activeNavItem,
            ]}
          >
            <Ionicons
              name="newspaper-outline"
              size={28}
              color={activeTab === "orders" ? "#FFFFFF" : inactiveIconColor}
            />
          </Pressable>

          {/* Favorites */}
          <Pressable
            onPress={() => handleNavigation("favorites", "Fav")}
            style={[
              styles.navItem,
              activeTab === "favorites" && styles.activeNavItem,
            ]}
          >
            <Ionicons
              name="heart-outline"
              size={28}
              color={activeTab === "favorites" ? "#FFFFFF" : inactiveIconColor}
            />
          </Pressable>

          {/* Profile */}
          <Pressable
            onPress={() => handleNavigation("profile", "Profile")}
            style={[
              styles.navItem,
              activeTab === "profile" && styles.activeNavItem,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={28}
              color={activeTab === "profile" ? "#FFFFFF" : inactiveIconColor}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  layoutContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navItem: {
    width: 75,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  activeNavItem: {
    width: 90,
    height: 55,
    borderRadius: 35,
    backgroundColor: "#DD3339",
    alignItems: "center",
    justifyContent: "center",
  },
});
