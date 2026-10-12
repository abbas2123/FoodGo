import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppSelector } from "@/hooks/useAppSelector";
import { AppStackParamList } from "@/navigation/types";
import { CartModal } from "@/components/common/CartModal";
import { useActiveRouteName } from "@/navigation/NavigationRouteContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatINR } from "@/utils/currency";

type Nav = NativeStackNavigationProp<AppStackParamList>;

// Routes where the floating cart bar must never appear
const HIDDEN_ON_ROUTES = new Set(["Checkout", "OrderDetails", "TrackOrderDetails"]);

export function GlobalCartBar() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const totalCount = useAppSelector((state) => state.cart.totalCount);
  const totalAmount = useAppSelector((state) => state.cart.totalAmount);
  const [isModalVisible, setIsModalVisible] = React.useState(false);

  // Self-suppression: component knows its own visibility rule based on route.
  // This is the defensive layer — Layout also hides it, but this guard ensures
  // the bar never renders on Checkout even during the re-render timing window
  // that exists between onStateChange firing and Layout re-rendering.
  const activeRoute = useActiveRouteName();
  const isHiddenRoute = HIDDEN_ON_ROUTES.has(activeRoute);
  const isDetailRoute =
    activeRoute === "RestaurantDetails" || activeRoute === "ProductDetails";
  const bottomPadding = isDetailRoute ? Math.max(insets.bottom, 14) : 10;

  const translateY = useRef(new Animated.Value(totalCount > 0 ? 0 : 120)).current;
  const prevCount = useRef(totalCount);

  useEffect(() => {
    if (totalCount > 0) {
      if (prevCount.current === 0) {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
      } else {
        translateY.setValue(0);
      }
    } else if (totalCount === 0 && prevCount.current > 0) {
      Animated.timing(translateY, {
        toValue: 120,
        duration: 250,
        useNativeDriver: true,
      }).start();
      setIsModalVisible(false);
    }
    prevCount.current = totalCount;
  }, [totalCount, translateY]);

  // Never render on Checkout or Order tracking
  if (isHiddenRoute) return null;

  if (totalCount === 0 && !isModalVisible) return null;

  return (
    <>
      {totalCount > 0 && (
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY }], paddingBottom: bottomPadding },
          ]}
        >
          <Pressable
            style={styles.bar}
            onPress={() => setIsModalVisible(true)}
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
          >
            <View style={styles.left}>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{totalCount}</Text>
              </View>
              <View>
                <Text style={styles.itemsText}>
                  {totalCount} {totalCount === 1 ? "item" : "items"}
                </Text>
                <Text style={styles.amountText}>{formatINR(totalAmount)}</Text>
              </View>
            </View>

            <View style={styles.right}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </View>
          </Pressable>
        </Animated.View>
      )}

      <CartModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onCheckout={() => {
          setIsModalVisible(false);
          navigation.navigate("Checkout");
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#C1121F",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: "#C1121F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  itemsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  amountText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    marginTop: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewCartText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
