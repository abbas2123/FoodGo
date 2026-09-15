import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import type { OrderStatus, DeliveryPartner, Order } from "@/types/order.types";

interface TrackingBottomSheetProps {
  order: Order;
  status: OrderStatus;
  etaText?: string;
  distanceText?: string;
  deliveryPartner?: DeliveryPartner;
  onViewOrderDetails?: () => void;
}

function getStatusTitle(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "Order Received";
    case "CONFIRMED":
      return "Order Confirmed";
    case "PREPARING":
      return "Restaurant is preparing your order";
    case "OUT_FOR_DELIVERY":
      return "On the way";
    case "DELIVERED":
      return "Order Delivered";
    case "CANCELLED":
      return "Order Cancelled";
    default:
      return "Tracking Order";
  }
}

function getStatusSubtitle(status: OrderStatus, etaText?: string): string {
  switch (status) {
    case "PREPARING":
      return "The chef is cooking up your meal";
    case "OUT_FOR_DELIVERY":
      return etaText ? etaText : "Delivery partner heading to your location";
    case "DELIVERED":
      return "Enjoy your food!";
    default:
      return "We're updating your delivery status";
  }
}

export const TrackingBottomSheet: React.FC<TrackingBottomSheetProps> =
  React.memo(
    ({
      order,
      status,
      etaText = "10–15 min",
      distanceText = "2.4 km away",
      deliveryPartner,
      onViewOrderDetails,
    }) => {
      const { theme } = useTheme();
      const insets = useSafeAreaInsets();

      const handleCall = useCallback(async () => {
        const phone = deliveryPartner?.phone || "+919876543210";
        const telUrl = `tel:${phone}`;
        try {
          const supported = await Linking.canOpenURL(telUrl);
          if (supported) {
            await Linking.openURL(telUrl);
          } else {
            Alert.alert("Call Partner", `Call delivery partner at ${phone}`);
          }
        } catch (err) {
          Alert.alert("Contact Partner", `Delivery partner phone: ${phone}`);
        }
      }, [deliveryPartner?.phone]);

      const bottomPadding = Math.max(insets.bottom, 16);

      return (
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.surface,
              paddingBottom: bottomPadding,
              borderTopColor: theme.border,
            },
          ]}
        >
          {/* Drag Handle indicator */}
          <View style={styles.handleContainer}>
            <View
              style={[styles.handleBar, { backgroundColor: theme.muted }]}
            />
          </View>

          {/* Header row: Status & ETA pill */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                {getStatusTitle(status)}
              </Text>
              <Text
                style={[styles.statusSubtitle, { color: theme.secondaryText }]}
              >
                {getStatusSubtitle(status, etaText)}
              </Text>
            </View>

            {/* Distance / ETA badge */}
            <View
              style={[styles.etaBadge, { backgroundColor: theme.primaryLight }]}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={theme.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.etaBadgeText, { color: theme.primary }]}>
                {distanceText}
              </Text>
            </View>
          </View>

          {/* Progress bar line */}
          <View
            style={[styles.progressTrack, { backgroundColor: theme.skeleton }]}
          >
            <View
              style={[styles.progressBar, { backgroundColor: theme.primary }]}
            />
          </View>

          {/* Delivery Partner Card */}
          {deliveryPartner && (
            <View
              style={[
                styles.partnerCard,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                },
              ]}
            >
              {/* Avatar */}
              {deliveryPartner.avatarUrl ? (
                <Image
                  source={{ uri: deliveryPartner.avatarUrl }}
                  style={styles.partnerAvatar}
                />
              ) : (
                <View
                  style={[
                    styles.partnerAvatarFallback,
                    { backgroundColor: theme.primaryLight },
                  ]}
                >
                  <Ionicons name="person" size={24} color={theme.primary} />
                </View>
              )}

              {/* Partner Details */}
              <View style={styles.partnerInfo}>
                <Text
                  style={[styles.partnerRole, { color: theme.secondaryText }]}
                >
                  Your Delivery Partner
                </Text>
                <Text style={[styles.partnerName, { color: theme.text }]}>
                  {deliveryPartner.name}
                </Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color="#FFC107" />
                  <Text
                    style={[
                      styles.ratingText,
                      { color: theme.secondaryText },
                    ]}
                  >
                    {" "}
                    {deliveryPartner.rating} • {deliveryPartner.totalDeliveries}+
                    deliveries
                  </Text>
                </View>
              </View>

              {/* Call Action Button */}
              <Pressable
                onPress={handleCall}
                style={({ pressed }) => [
                  styles.callButton,
                  {
                    backgroundColor: theme.primary,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  },
                ]}
                hitSlop={8}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" />
                <Text style={styles.callButtonText}>Call</Text>
              </Pressable>
            </View>
          )}

          {/* Order Summary Strip */}
          <Pressable
            onPress={onViewOrderDetails}
            style={[
              styles.orderSummaryStrip,
              { borderTopColor: theme.border },
            ]}
          >
            <View style={styles.orderSummaryLeft}>
              <View
                style={[
                  styles.restaurantDot,
                  { backgroundColor: theme.primary },
                ]}
              />
              <Text
                style={[styles.restaurantName, { color: theme.text }]}
                numberOfLines={1}
              >
                {order.restaurant.name}
              </Text>
              <Text
                style={[styles.orderMeta, { color: theme.muted }]}
              >
                {" "}
                • {order.items.length}{" "}
                {order.items.length === 1 ? "item" : "items"}
              </Text>
            </View>

            <View style={styles.orderSummaryRight}>
              <Text style={[styles.viewDetailsText, { color: theme.primary }]}>
                View Order
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.primary}
              />
            </View>
          </Pressable>
        </View>
      );
    }
  );

TrackingBottomSheet.displayName = "TrackingBottomSheet";

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 4,
    marginBottom: 8,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: 10,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  statusSubtitle: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: "500",
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  etaBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginVertical: 10,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    width: "75%",
    borderRadius: 2,
  },
  partnerCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 12,
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  partnerAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  partnerRole: {
    fontSize: 11,
    fontWeight: "500",
  },
  partnerName: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "600",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    gap: 5,
    shadowColor: "#C1121F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  orderSummaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  orderSummaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  restaurantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  restaurantName: {
    fontSize: 13,
    fontWeight: "700",
    maxWidth: "50%",
  },
  orderMeta: {
    fontSize: 13,
  },
  orderSummaryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
