import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Pressable,
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList } from "@/navigation/types";

import { getOrderTab, Order } from "@/types/order.types";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { fetchOrders, reorderPastOrder } from "@/store/slices/ordersSlice";
import { addToCart } from "@/store/slices/cartSlice";

const tabs = ["All", "Ongoing", "Completed", "Cancelled"] as const;
type TabType = (typeof tabs)[number];

function formatOrderListItem(o: Order) {
  return {
    id: o.id,
    orderNumber:
      o.status === "OUT_FOR_DELIVERY" ||
      o.status === "PENDING" ||
      o.status === "CONFIRMED" ||
      o.status === "PREPARING"
        ? `Order #${o.orderNumber}`
        : `Order #${o.orderNumber} • ${
            o.completedAt
              ? new Date(o.completedAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })
              : ""
          }`,
    restaurantName: o.restaurant.name,
    status: getOrderTab(o.status) as "Ongoing" | "Completed" | "Cancelled",
    statusLabel: o.statusLabel,
    items: o.items.map((i) => `${i.quantity}x ${i.name}`).join(", "),
    price: `${o.bill.currencySymbol}${o.bill.grandTotal}`,
  };
}

export default function OrdersPage() {
  const [selectedTab, setSelectedTab] = useState<TabType>("All");
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();

  const storeOrders = useAppSelector((state) => state.orders.orders);
  const loading = useAppSelector((state) => state.orders.loading);

  const onRefresh = useCallback(() => {
    dispatch(fetchOrders());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchOrders());
  }, [dispatch]);

  const handleReorder = useCallback(
    async (orderId: string) => {
      try {
        const result = await dispatch(reorderPastOrder(orderId)).unwrap();
        if (result && result.items) {
          result.items.forEach((item) => {
            dispatch(
              addToCart({
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.image,
                restaurantId: result.restaurantId,
                quantity: item.quantity,
              }),
            );
          });
          if (result.unavailableCount > 0) {
            Alert.alert(
              "Reorder Updated",
              `${result.unavailableCount} item(s) are no longer available and were skipped. Available items added to your cart!`,
            );
          }
          navigation.navigate("Checkout");
        }
      } catch (err: any) {
        Alert.alert("Reorder Failed", err || "Could not reorder this order.");
      }
    },
    [dispatch, navigation],
  );

  const ordersList = useMemo(() => {
    return storeOrders.map(formatOrderListItem);
  }, [storeOrders]);

  const filteredOrders =
    selectedTab === "All"
      ? ordersList
      : ordersList.filter((order) => order.status === selectedTab);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            colors={["#D71920"]}
            tintColor="#D71920"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>

        {/* Order Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {tabs.map((tab) => {
            const active = selectedTab === tab;

            return (
              <Pressable
                key={tab}
                onPress={() => setSelectedTab(tab)}
                style={[styles.tab, active && styles.activeTab]}
              >
                <Text style={[styles.tabText, active && styles.activeTabText]}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={
                selectedTab === "Completed"
                  ? "checkmark-circle-outline"
                  : selectedTab === "Cancelled"
                    ? "close-circle-outline"
                    : "receipt-outline"
              }
              size={60}
              color="#D71920"
            />
            <Text style={styles.emptyTitle}>
              {selectedTab === "All" ? "No Orders" : `${selectedTab} Orders`}
            </Text>
            <Text style={styles.emptyText}>
              {selectedTab === "All"
                ? "You have not placed any orders yet."
                : `Your ${selectedTab.toLowerCase()} orders will appear here.`}
            </Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.foodImage}>
                  <Ionicons
                    name="fast-food-outline"
                    size={32}
                    color="#D71920"
                  />
                </View>

                <View style={styles.restaurantInfo}>
                  <Text style={styles.restaurantName}>
                    {order.restaurantName}
                  </Text>
                  <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                </View>

                {order.status === "Ongoing" && (
                  <View style={styles.statusContainer}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>{order.statusLabel}</Text>
                  </View>
                )}

                {order.status === "Completed" && (
                  <View style={styles.deliveredContainer}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={14}
                      color="#00897B"
                    />
                    <Text style={styles.deliveredText}>
                      {order.statusLabel}
                    </Text>
                  </View>
                )}

                {order.status === "Cancelled" && (
                  <View style={styles.cancelledStatusContainer}>
                    <Ionicons
                      name="close-circle-outline"
                      size={14}
                      color="#D71920"
                    />
                    <Text style={styles.cancelledStatusText}>
                      {order.statusLabel}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.itemRow}>
                <Text style={styles.itemText}>{order.items}</Text>
                <Text style={styles.price}>{order.price}</Text>
              </View>

              {order.status === "Ongoing" && (
                <Pressable
                  style={styles.trackButton}
                  onPress={() =>
                    navigation.navigate("TrackOrderDetails", {
                      orderId: order.id,
                    })
                  }
                >
                  <Text style={styles.trackButtonText}>Track Order</Text>
                </Pressable>
              )}

              {order.status === "Completed" && (
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.detailsButton}
                    onPress={() =>
                      navigation.navigate("OrderDetails", {
                        orderId: order.id,
                      })
                    }
                  >
                    <Text style={styles.detailsText}>View Details</Text>
                  </Pressable>

                  <Pressable
                    style={styles.reorderButton}
                    onPress={() => handleReorder(order.id)}
                  >
                    <Text style={styles.reorderText}>Reorder</Text>
                  </Pressable>
                </View>
              )}

              {order.status === "Cancelled" && (
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.detailsButton}
                    onPress={() =>
                      navigation.navigate("OrderDetails", {
                        orderId: order.id,
                      })
                    }
                  >
                    <Text style={styles.detailsText}>View Details</Text>
                  </Pressable>
                  <Pressable
                    style={styles.reorderButton}
                    onPress={() => handleReorder(order.id)}
                  >
                    <Text style={styles.reorderText}>Reorder</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F9",
  },

  scrollContent: {
    paddingBottom: 30,
  },

  // Header

  header: {
    height: 70,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  menuButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#292322",
  },

  profileButton: {
    width: 40,
    height: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  // Tabs

  tabsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },

  tab: {
    minWidth: 105,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: "#FFE8E5",
    borderWidth: 1,
    borderColor: "#F4C8C4",
    alignItems: "center",
    justifyContent: "center",
  },

  activeTab: {
    backgroundColor: "#FFDCD8",
    borderColor: "#F0B5B0",
  },

  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#292322",
  },

  activeTabText: {
    color: "#292322",
    fontWeight: "700",
  },

  // Order Card

  orderCard: {
    backgroundColor: "#FFF9F8",
    marginHorizontal: 20,
    marginTop: 10,
    padding: 15,
    borderRadius: 18,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,

    elevation: 3,
  },

  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  foodImage: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },

  restaurantInfo: {
    flex: 1,
    marginLeft: 12,
  },

  restaurantName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#292322",
  },

  orderNumber: {
    marginTop: 4,
    fontSize: 12,
    color: "#777",
  },

  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFE9E7",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 15,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FF5A5F",
    marginRight: 5,
  },

  statusText: {
    fontSize: 11,
    color: "#292322",
    fontWeight: "500",
  },

  deliveredContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  deliveredText: {
    fontSize: 11,
    color: "#00897B",
    fontWeight: "600",
  },

  cancelledStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEAEA",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 3,
  },

  cancelledStatusText: {
    fontSize: 11,
    color: "#D71920",
    fontWeight: "600",
  },

  divider: {
    height: 1,
    backgroundColor: "#F3D9D6",
    marginVertical: 14,
  },

  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  itemText: {
    fontSize: 13,
    color: "#292322",
  },

  price: {
    fontSize: 15,
    fontWeight: "700",
    color: "#292322",
  },

  // Track

  trackButton: {
    height: 48,
    backgroundColor: "#FF5257",
    borderRadius: 12,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  trackButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // Actions

  actionRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 18,
  },

  detailsButton: {
    flex: 1,
    height: 40,
    backgroundColor: "#FFE7E4",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  detailsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#292322",
  },

  reorderButton: {
    flex: 1,
    height: 40,
    backgroundColor: "#FFE7E4",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  reorderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FF5257",
  },

  // Empty

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 100,
  },

  emptyTitle: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: "700",
    color: "#292322",
  },

  emptyText: {
    marginTop: 7,
    fontSize: 13,
    color: "#888",
    textAlign: "center",
  },
});
