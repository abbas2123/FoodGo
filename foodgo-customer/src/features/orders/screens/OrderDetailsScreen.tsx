/**
 * OrderDetailsScreen
 *
 * Dynamically renders the correct UI depending on order status:
 *   • ACTIVE (PENDING / CONFIRMED / PREPARING / OUT_FOR_DELIVERY)  → Active layout
 *   • DELIVERED                                                      → Completed layout
 *   • CANCELLED                                                      → Cancelled layout
 *
 * Theming: fully adopts the app's light/dark theme via useTheme().
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import type { Order, OrderItem } from "@/types/order.types";
import { isActiveOrder, isCompletedOrder } from "@/types/order.types";

import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  fetchOrderById,
  cancelOrder,
  submitOrderReview,
  reorderPastOrder,
} from "@/store/slices/ordersSlice";
import { addToCart } from "@/store/slices/cartSlice";

// ─── Route type ─────────────────────────────────────────────────────────────

type OrderDetailsRouteProp = RouteProp<AppStackParamList, "OrderDetails">;

// ─── Progress step config ────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  { icon: "restaurant-outline" as const, label: "Order\nPlaced" },
  { icon: "construct-outline" as const, label: "Preparing" },
  { icon: "bicycle-outline" as const, label: "On the\nway" },
  { icon: "home-outline" as const, label: "Delivered" },
] as const;

type ProgressStepIcon = (typeof PROGRESS_STEPS)[number]["icon"];

function getActiveStep(status: Order["status"]): number {
  switch (status) {
    case "PENDING":
    case "CONFIRMED":
      return 0;
    case "PREPARING":
      return 1;
    case "OUT_FOR_DELIVERY":
      return 2;
    case "DELIVERED":
      return 3;
    default:
      return 0;
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Horizontally scrolling progress tracker for active orders */
function OrderProgressTracker({
  status,
  colors,
}: {
  status: Order["status"];
  colors: ReturnType<typeof useTheme>["theme"];
}) {
  const activeStep = getActiveStep(status);

  return (
    <View style={progressStyles.container}>
      {PROGRESS_STEPS.map((step, idx) => {
        const isActive = idx <= activeStep;
        const isLast = idx === PROGRESS_STEPS.length - 1;

        return (
          <View key={step.label} style={progressStyles.stepWrapper}>
            {/* Icon circle */}
            <View
              style={[
                progressStyles.circle,
                isActive
                  ? progressStyles.circleActive
                  : { backgroundColor: colors.skeleton, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name={step.icon}
                size={18}
                color={isActive ? "#FFFFFF" : colors.muted}
              />
            </View>

            {/* Connector line (not on last step) */}
            {!isLast && (
              <View
                style={[
                  progressStyles.line,
                  idx < activeStep
                    ? progressStyles.lineActive
                    : { backgroundColor: colors.border },
                ]}
              />
            )}

            {/* Label */}
            <Text
              style={[
                progressStyles.label,
                { color: isActive ? colors.primary : colors.muted },
              ]}
              numberOfLines={2}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginVertical: 16,
  },
  stepWrapper: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    zIndex: 1,
  },
  circleActive: {
    backgroundColor: "#C1121F",
    borderColor: "#C1121F",
  },
  line: {
    position: "absolute",
    top: 19,
    left: "50%",
    right: "-50%",
    height: 3,
    borderRadius: 2,
  },
  lineActive: {
    backgroundColor: "#C1121F",
  },
  label: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 13,
  },
});

/** Single order-item row */
function OrderItemRow({
  item,
  colors,
  showDivider,
}: {
  item: OrderItem;
  colors: ReturnType<typeof useTheme>["theme"];
  showDivider: boolean;
}) {
  return (
    <>
      <View style={itemStyles.row}>
        <View style={[itemStyles.qtyBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[itemStyles.qtyText, { color: colors.primary }]}>
            {item.quantity}x
          </Text>
        </View>
        <View style={itemStyles.info}>
          <Text style={[itemStyles.name, { color: colors.text }]}>{item.name}</Text>
          {!!item.customisation && (
            <Text style={[itemStyles.custom, { color: colors.muted }]}>
              {item.customisation}
            </Text>
          )}
        </View>
        <Text style={[itemStyles.price, { color: colors.text }]}>
          {item.quantity * item.price > 999
            ? `$${((item.quantity * item.price) / 100).toFixed(2)}`
            : `₹${item.quantity * item.price}`}
        </Text>
      </View>
      {showDivider && (
        <View style={[itemStyles.divider, { backgroundColor: colors.border }]} />
      )}
    </>
  );
}

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  qtyBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
  },
  qtyText: {
    fontSize: 11,
    fontWeight: "700",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
  },
  custom: {
    fontSize: 11,
    marginTop: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});

/** Star rating component */
function StarRating({
  rating,
  onRate,
}: {
  rating: number;
  onRate: (star: number) => void;
}) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onRate(star)} hitSlop={8}>
          <Ionicons
            name={star <= rating ? "star" : "star-outline"}
            size={36}
            color={star <= rating ? "#FFC107" : "#D0D0D0"}
            style={starStyles.star}
          />
        </Pressable>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginVertical: 12,
  },
  star: {
    marginHorizontal: 2,
  },
});

// ─── Bill row helper ─────────────────────────────────────────────────────────

function BillRow({
  label,
  value,
  isBold,
  isDiscount,
  colors,
}: {
  label: string;
  value: string;
  isBold?: boolean;
  isDiscount?: boolean;
  colors: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={billRowStyles.row}>
      <View style={billRowStyles.labelGroup}>
        {isDiscount && (
          <Ionicons name="pricetag-outline" size={12} color="#22C55E" style={{ marginRight: 4 }} />
        )}
        <Text
          style={[
            billRowStyles.label,
            { color: isBold ? colors.text : colors.secondaryText },
            isBold && billRowStyles.bold,
          ]}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          billRowStyles.value,
          { color: isDiscount ? "#22C55E" : isBold ? colors.text : colors.secondaryText },
          isBold && billRowStyles.bold,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const billRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 5,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 13,
  },
  bold: {
    fontWeight: "700",
    fontSize: 15,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrderDetailsScreen() {
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<OrderDetailsRouteProp>();

  const dispatch = useAppDispatch();
  const orderId = route.params?.orderId;
  const storeCurrentOrder = useAppSelector((state) => state.orders.currentOrder);
  const storeOrders = useAppSelector((state) => state.orders.orders);

  useEffect(() => {
    if (orderId) {
      dispatch(fetchOrderById(orderId));
    }
  }, [dispatch, orderId]);

  // Resolve order from Redux store (backend-driven)
  const order =
    (storeCurrentOrder && String(storeCurrentOrder.id) === String(orderId)
      ? storeCurrentOrder
      : null) ??
    storeOrders.find((o) => String(o.id) === String(orderId)) ??
    undefined;

  // Rating state
  const [rating, setRating] = useState<number>(order?.userRating ?? 0);
  const [comment, setComment] = useState<string>(order?.userComment ?? "");
  const [ratingSubmitted, setRatingSubmitted] = useState(
    Boolean(order?.userRating && order.userRating > 0),
  );

  useEffect(() => {
    if (order?.userRating && order.userRating > 0) {
      setRating(order.userRating);
      setRatingSubmitted(true);
      if (order.userComment) setComment(order.userComment);
    }
  }, [order?.userRating, order?.userComment]);

  const handleSubmitRating = useCallback(async () => {
    if (rating === 0) {
      Alert.alert("Rate your order", "Please select at least 1 star.");
      return;
    }
    if (!order?.id) return;
    try {
      await dispatch(
        submitOrderReview({
          orderId: order.id,
          rating,
          comment: comment.trim() || undefined,
        }),
      ).unwrap();
      setRatingSubmitted(true);
      Alert.alert("Thank you!", "Your review has been submitted.");
    } catch (err: any) {
      Alert.alert("Submission Failed", err || "Could not submit your review.");
    }
  }, [rating, comment, order?.id, dispatch]);

  const handleReorder = useCallback(async () => {
    if (!order?.id) return;
    try {
      const result = await dispatch(reorderPastOrder(order.id)).unwrap();
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
  }, [order?.id, dispatch, navigation]);

  const handleCancelOrder = useCallback(() => {
    if (!order?.id) return;
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(cancelOrder(order.id)).unwrap();
              Alert.alert(
                "Order Cancelled",
                "Your order has been cancelled successfully.",
              );
            } catch (err: any) {
              Alert.alert("Cancel Failed", err || "Could not cancel this order.");
            }
          },
        },
      ],
    );
  }, [order?.id, dispatch]);

  // ── Guard: order not found ────────────────────────────────────────────────
  if (!order) {
    return (
      <View style={[screenStyles.root, { backgroundColor: theme.background }]}>
        <View style={[screenStyles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => navigation.goBack()} style={screenStyles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={theme.primary} />
          </Pressable>
          <Text style={[screenStyles.headerTitle, { color: theme.text }]}>Order Details</Text>
          <View style={screenStyles.headerRight} />
        </View>
        <View style={screenStyles.notFound}>
          <Ionicons name="receipt-outline" size={64} color={theme.muted} />
          <Text style={[screenStyles.notFoundText, { color: theme.muted }]}>
            Order not found
          </Text>
        </View>
      </View>
    );
  }

  const active = isActiveOrder(order.status);
  const completed = isCompletedOrder(order.status);
  const cancelled = order.status === "CANCELLED";

  const sym = order.bill.currencySymbol;
  const fmt = (n: number) =>
    n >= 1000 ? `${sym}${(n / 100).toFixed(2)}` : `${sym}${n}`;

  // ─── ACTIVE layout ────────────────────────────────────────────────────────
  if (active) {
    return (
      <View style={[screenStyles.root, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[screenStyles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => navigation.goBack()} style={screenStyles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={theme.primary} />
          </Pressable>
          <Text style={[screenStyles.headerTitle, { color: theme.text }]}>Order Details</Text>
          <View style={screenStyles.headerRight} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={screenStyles.scrollContent}
        >
          {/* Status banner */}
          <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
            <View style={screenStyles.statusRow}>
              <Text style={[screenStyles.statusHeading, { color: theme.text }]}>
                {order.statusLabel}
              </Text>
              <View style={[screenStyles.orderBadge, { backgroundColor: theme.primaryLight }]}>
                <Text style={[screenStyles.orderBadgeText, { color: theme.primary }]}>
                  Order #{order.orderNumber}
                </Text>
              </View>
            </View>
            {!!order.eta && (
              <Text style={[screenStyles.etaText, { color: theme.primary }]}>
                Arriving in {order.eta}
              </Text>
            )}

            {/* Progress tracker */}
            <OrderProgressTracker status={order.status} colors={theme} />

            {/* Track Order button */}
            <Pressable
              style={[screenStyles.trackBtn, { backgroundColor: theme.primary }]}
              onPress={() =>
                navigation.navigate("TrackOrderDetails", {
                  orderId: order.id,
                })
              }
            >
              <Ionicons name="map-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={screenStyles.trackBtnText}>Track Order</Text>
            </Pressable>
          </View>

          {/* Restaurant info */}
          <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
            <View style={screenStyles.restaurantRow}>
              {order.restaurant.imageUrl ? (
                <Image
                  source={{ uri: order.restaurant.imageUrl }}
                  style={screenStyles.restaurantImg}
                />
              ) : (
                <View
                  style={[screenStyles.restaurantImgPlaceholder, { backgroundColor: theme.skeleton }]}
                >
                  <Ionicons name="fast-food-outline" size={28} color={theme.muted} />
                </View>
              )}
              <View style={screenStyles.restaurantMeta}>
                <Text style={[screenStyles.restaurantName, { color: theme.text }]}>
                  {order.restaurant.name}
                </Text>
                <Text style={[screenStyles.restaurantCuisine, { color: theme.secondaryText }]}>
                  {order.restaurant.cuisine}
                </Text>
                <View style={screenStyles.restaurantBadgeRow}>
                  {order.restaurant.rating && (
                    <View style={[screenStyles.ratingBadge, { backgroundColor: "#22C55E20" }]}>
                      <Ionicons name="star" size={10} color="#22C55E" />
                      <Text style={[screenStyles.ratingText, { color: "#22C55E" }]}>
                        {" "}{order.restaurant.rating}
                      </Text>
                    </View>
                  )}
                  {order.restaurant.distanceKm && (
                    <Text style={[screenStyles.distanceText, { color: theme.muted }]}>
                      {" • "}
                      {order.restaurant.distanceKm} km away
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.muted} />
            </View>
          </View>

          {/* Your Order */}
          <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
            <Text style={[screenStyles.sectionTitle, { color: theme.text }]}>Your Order</Text>
            {order.items.map((item, idx) => (
              <OrderItemRow
                key={item.id}
                item={item}
                colors={theme}
                showDivider={idx < order.items.length - 1}
              />
            ))}

            {/* Add instructions */}
            <Pressable style={[screenStyles.addInstructions, { borderColor: theme.primaryLight }]}>
              <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
              <Text style={[screenStyles.addInstructionsText, { color: theme.primary }]}>
                Add Instructions for Restaurant
              </Text>
            </Pressable>
          </View>

          {/* Bill Summary */}
          <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
            <Text style={[screenStyles.sectionTitle, { color: theme.text }]}>Bill Summary</Text>
            <BillRow label="Subtotal" value={fmt(order.bill.subtotal)} colors={theme} />
            <BillRow label="Delivery Fee" value={fmt(order.bill.deliveryFee)} colors={theme} />
            <BillRow label="Taxes & Charges" value={fmt(order.bill.taxes)} colors={theme} />
            {order.bill.discount > 0 && (
              <BillRow
                label="Discount"
                value={`-${fmt(order.bill.discount)}`}
                isDiscount
                colors={theme}
              />
            )}
            <View style={[screenStyles.divider, { backgroundColor: theme.border }]} />
            <BillRow
              label="Grand Total"
              value={fmt(order.bill.grandTotal)}
              isBold
              colors={theme}
            />
          </View>

          {/* Delivery address */}
          <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
            <View style={screenStyles.infoRow}>
              <View style={[screenStyles.infoIcon, { backgroundColor: "#FDE9E820" }]}>
                <Ionicons name="home-outline" size={18} color={theme.primary} />
              </View>
              <View style={screenStyles.infoText}>
                <Text style={[screenStyles.infoLabel, { color: theme.text }]}>
                  Delivered to {order.deliveryAddress.label}
                </Text>
                <Text style={[screenStyles.infoSub, { color: theme.secondaryText }]}>
                  {order.deliveryAddress.line1}
                </Text>
              </View>
            </View>
          </View>

          {/* Payment method */}
          <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
            <View style={screenStyles.infoRow}>
              <View style={[screenStyles.infoIcon, { backgroundColor: "#22C55E20" }]}>
                <Ionicons name="card-outline" size={18} color="#22C55E" />
              </View>
              <View style={screenStyles.infoText}>
                <Text style={[screenStyles.infoLabel, { color: theme.text }]}>
                  Payment Method
                </Text>
                <Text style={[screenStyles.infoSub, { color: theme.secondaryText }]}>
                  {order.payment.method}
                </Text>
                {order.payment.isPaid && (
                  <View style={screenStyles.paidBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                    <Text style={screenStyles.paidText}>Paid</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Cancel Order button if pending or confirmed */}
          {(order.status === "PENDING" || order.status === "CONFIRMED") && (
            <Pressable
              style={[
                screenStyles.cancelOrderBtn,
                { borderColor: "#EF4444", backgroundColor: theme.surface },
              ]}
              onPress={handleCancelOrder}
            >
              <Ionicons
                name="close-circle-outline"
                size={18}
                color="#EF4444"
                style={{ marginRight: 8 }}
              />
              <Text style={screenStyles.cancelOrderBtnText}>Cancel Order</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    );
  }

  // ─── COMPLETED layout ─────────────────────────────────────────────────────
  if (completed) {
    // Format completed date
    const deliveredDate = order.completedAt
      ? new Date(order.completedAt).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "";

    return (
      <View style={[screenStyles.root, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[screenStyles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => navigation.goBack()} style={screenStyles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={theme.primary} />
          </Pressable>
          <Text style={[screenStyles.headerTitle, { color: theme.primary }]}>Order Details</Text>
          <View style={screenStyles.headerRight} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={screenStyles.scrollContent}
        >
          {/* Delivered confirmation */}
          <View style={[screenStyles.card, { backgroundColor: theme.surface, alignItems: "center", paddingVertical: 28 }]}>
            <View style={completedStyles.checkCircle}>
              <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
            </View>
            <Text style={[completedStyles.deliveredText, { color: theme.text }]}>Delivered</Text>
            <Text style={[completedStyles.deliveredDate, { color: theme.secondaryText }]}>
              {deliveredDate}
            </Text>
          </View>

          {/* Rating card */}
          {!ratingSubmitted ? (
            <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
              <Text style={[completedStyles.ratingTitle, { color: theme.text }]}>
                How was your order?
              </Text>
              <StarRating rating={rating} onRate={setRating} />
              <TextInput
                style={[
                  completedStyles.commentInput,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Add a comment..."
                placeholderTextColor={theme.muted}
                multiline
                numberOfLines={3}
                value={comment}
                onChangeText={setComment}
              />
              <Pressable
                style={[completedStyles.submitBtn, { backgroundColor: theme.primary }]}
                onPress={handleSubmitRating}
              >
                <Text style={completedStyles.submitBtnText}>Submit Rating</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[screenStyles.card, { backgroundColor: theme.surface, alignItems: "center" }]}>
              <Ionicons name="star" size={32} color="#FFC107" />
              <Text style={[completedStyles.ratingTitle, { color: theme.text, marginTop: 8 }]}>
                Rating Submitted — Thank you!
              </Text>
              <StarRating rating={rating} onRate={() => {}} />
            </View>
          )}

          {/* Restaurant + items */}
          <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
            <View style={screenStyles.restaurantRow}>
              {order.restaurant.imageUrl ? (
                <Image
                  source={{ uri: order.restaurant.imageUrl }}
                  style={screenStyles.restaurantImg}
                />
              ) : (
                <View
                  style={[screenStyles.restaurantImgPlaceholder, { backgroundColor: theme.skeleton }]}
                >
                  <Ionicons name="fast-food-outline" size={28} color={theme.muted} />
                </View>
              )}
              <View style={screenStyles.restaurantMeta}>
                <Text style={[screenStyles.restaurantName, { color: theme.text }]}>
                  {order.restaurant.name}
                </Text>
                <Text style={[screenStyles.restaurantCuisine, { color: theme.secondaryText }]}>
                  Order #{order.orderNumber}
                </Text>
              </View>
            </View>

            <View style={[screenStyles.divider, { backgroundColor: theme.border, marginVertical: 12 }]} />

            {order.items.map((item, idx) => (
              <OrderItemRow
                key={item.id}
                item={item}
                colors={theme}
                showDivider={idx < order.items.length - 1}
              />
            ))}
          </View>

          {/* Receipt */}
          <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
            <Text style={[screenStyles.sectionTitle, { color: theme.text }]}>Receipt</Text>
            <BillRow label="Subtotal" value={fmt(order.bill.subtotal)} colors={theme} />
            <BillRow label="Delivery Fee" value={fmt(order.bill.deliveryFee)} colors={theme} />
            <BillRow label="Taxes & Fees" value={fmt(order.bill.taxes)} colors={theme} />
            {order.bill.discount > 0 && (
              <BillRow
                label="Discount"
                value={`-${fmt(order.bill.discount)}`}
                isDiscount
                colors={theme}
              />
            )}
            <View style={[screenStyles.divider, { backgroundColor: theme.border }]} />
            <BillRow
              label="Total"
              value={fmt(order.bill.grandTotal)}
              isBold
              colors={theme}
            />
          </View>

          {/* Reorder button */}
          <Pressable
            style={[completedStyles.reorderBtn, { backgroundColor: theme.primaryLight }]}
            onPress={handleReorder}
          >
            <Ionicons name="refresh-outline" size={18} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={[completedStyles.reorderText, { color: theme.primary }]}>Reorder</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ─── CANCELLED layout ─────────────────────────────────────────────────────
  return (
    <View style={[screenStyles.root, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[screenStyles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={screenStyles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
        </Pressable>
        <Text style={[screenStyles.headerTitle, { color: theme.text }]}>Order Details</Text>
        <View style={screenStyles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={screenStyles.scrollContent}
      >
        {/* Cancelled status */}
        <View style={[screenStyles.card, { backgroundColor: theme.surface, alignItems: "center", paddingVertical: 28 }]}>
          <View style={cancelledStyles.iconCircle}>
            <Ionicons name="close-circle" size={56} color="#EF4444" />
          </View>
          <Text style={[cancelledStyles.cancelledText, { color: theme.text }]}>
            Order Cancelled
          </Text>
          <Text style={[cancelledStyles.cancelledSub, { color: theme.secondaryText }]}>
            Your order #{order.orderNumber} was cancelled.
          </Text>
        </View>

        {/* Restaurant + items */}
        <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
          <View style={screenStyles.restaurantRow}>
            {order.restaurant.imageUrl ? (
              <Image
                source={{ uri: order.restaurant.imageUrl }}
                style={screenStyles.restaurantImg}
              />
            ) : (
              <View
                style={[screenStyles.restaurantImgPlaceholder, { backgroundColor: theme.skeleton }]}
              >
                <Ionicons name="fast-food-outline" size={28} color={theme.muted} />
              </View>
            )}
            <View style={screenStyles.restaurantMeta}>
              <Text style={[screenStyles.restaurantName, { color: theme.text }]}>
                {order.restaurant.name}
              </Text>
              <Text style={[screenStyles.restaurantCuisine, { color: theme.secondaryText }]}>
                {order.restaurant.cuisine}
              </Text>
            </View>
          </View>
          <View style={[screenStyles.divider, { backgroundColor: theme.border, marginVertical: 12 }]} />
          {order.items.map((item, idx) => (
            <OrderItemRow
              key={item.id}
              item={item}
              colors={theme}
              showDivider={idx < order.items.length - 1}
            />
          ))}
        </View>

        {/* Bill */}
        <View style={[screenStyles.card, { backgroundColor: theme.surface }]}>
          <Text style={[screenStyles.sectionTitle, { color: theme.text }]}>Bill Summary</Text>
          <BillRow label="Subtotal" value={fmt(order.bill.subtotal)} colors={theme} />
          <BillRow label="Delivery Fee" value={fmt(order.bill.deliveryFee)} colors={theme} />
          <BillRow label="Taxes & Charges" value={fmt(order.bill.taxes)} colors={theme} />
          {order.bill.discount > 0 && (
            <BillRow
              label="Discount"
              value={`-${fmt(order.bill.discount)}`}
              isDiscount
              colors={theme}
            />
          )}
          <View style={[screenStyles.divider, { backgroundColor: theme.border }]} />
          <BillRow label="Grand Total" value={fmt(order.bill.grandTotal)} isBold colors={theme} />
        </View>

        {/* Reorder */}
        <Pressable
          style={[completedStyles.reorderBtn, { backgroundColor: theme.primaryLight }]}
          onPress={handleReorder}
        >
          <Ionicons name="refresh-outline" size={18} color={theme.primary} style={{ marginRight: 8 }} />
          <Text style={[completedStyles.reorderText, { color: theme.primary }]}>Reorder</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Shared screen styles ─────────────────────────────────────────────────────

const screenStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  headerRight: {
    width: 36,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  statusHeading: {
    fontSize: 18,
    fontWeight: "800",
  },
  orderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  orderBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  etaText: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  trackBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  trackBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelOrderBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  cancelOrderBtnText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "700",
  },
  restaurantRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  restaurantImg: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  restaurantImgPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantMeta: {
    flex: 1,
    marginLeft: 12,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: "700",
  },
  restaurantCuisine: {
    fontSize: 12,
    marginTop: 2,
  },
  restaurantBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "600",
  },
  distanceText: {
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  addInstructions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  addInstructionsText: {
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  paidText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22C55E",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

// ─── Completed-specific styles ────────────────────────────────────────────────

const completedStyles = StyleSheet.create({
  checkCircle: {
    marginBottom: 12,
  },
  deliveredText: {
    fontSize: 22,
    fontWeight: "800",
  },
  deliveredDate: {
    fontSize: 13,
    marginTop: 4,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  commentInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: "top",
    marginTop: 8,
  },
  submitBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  reorderBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  reorderText: {
    fontSize: 15,
    fontWeight: "700",
  },
});

// ─── Cancelled-specific styles ────────────────────────────────────────────────

const cancelledStyles = StyleSheet.create({
  iconCircle: {
    marginBottom: 12,
  },
  cancelledText: {
    fontSize: 22,
    fontWeight: "800",
  },
  cancelledSub: {
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
});
