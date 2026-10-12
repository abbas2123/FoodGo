import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { clearCart, clearCartServer, fetchCart } from "@/store/slices/cartSlice";
import { selectSelectedAddress } from "@/store/slices/addressSlice";
import { placeOrder } from "@/store/slices/ordersSlice";
import { ordersApi } from "@/api/orders/ordersApi";
import { paymentsApi, PaymentOrderData } from "@/api/payments/paymentsApi";
import {
  RazorpayCheckoutModal,
  RazorpayCheckoutSuccessResult,
  RazorpayPaymentError,
} from "../components/RazorpayCheckoutModal";
import { AppStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import {
  formatINR,
  FREE_DELIVERY_THRESHOLD_INR,
  DELIVERY_FEE_INR,
  PLATFORM_FEE_INR,
} from "@/utils/currency";

type Nav = NativeStackNavigationProp<AppStackParamList>;
type PaymentMethod = "cod" | "card" | "upi";

type CheckoutState =
  | "IDLE"
  | "CREATING_ORDER"
  | "CREATING_PAYMENT"
  | "PAYMENT_SHEET"
  | "VERIFYING"
  | "SUCCESS"
  | "FAILED";

export default function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();

  const cartItems = useAppSelector((state) => state.cart.items);
  const totalCount = useAppSelector((state) => state.cart.totalCount);
  const totalAmount = useAppSelector((state) => state.cart.totalAmount);
  const cartRestaurantId = useAppSelector((state) => state.cart.restaurantId);
  const location = useAppSelector((state) => state.location);
  const selectedAddress = useAppSelector(selectSelectedAddress);
  const currentUser = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("IDLE");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [realOrderId, setRealOrderId] = useState("");
  const [checkoutGroupId, setCheckoutGroupId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentOrderData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Safeguards against race conditions, duplicate callbacks, and unmounted state updates
  const isVerifyingRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Prefer a saved Redux address, otherwise fall back to GPS location
  const deliveryAddress = selectedAddress
    ? [
        selectedAddress.address_line1,
        selectedAddress.address_line2,
        selectedAddress.city,
        selectedAddress.state,
        selectedAddress.postal_code,
      ]
        .filter(Boolean)
        .join(", ")
    : location.formattedAddress ||
      location.displayLocation ||
      location.city ||
      "Enter a delivery address";

  const deliveryFee =
    totalAmount >= FREE_DELIVERY_THRESHOLD_INR || totalAmount === 0
      ? 0
      : DELIVERY_FEE_INR;
  const taxesAndFees = totalAmount > 0 ? PLATFORM_FEE_INR : 0;
  const grandTotal = totalAmount + deliveryFee + taxesAndFees;

  const isBusy =
    checkoutState === "CREATING_ORDER" ||
    checkoutState === "CREATING_PAYMENT" ||
    checkoutState === "VERIFYING";

  // Group cart items by restaurantId for multi-restaurant checkout
  const itemsByRestaurant = cartItems.reduce<Record<string, typeof cartItems>>(
    (acc, item) => {
      const key = item.restaurantId || cartRestaurantId || "1";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {},
  );
  const isMultiRestaurant = Object.keys(itemsByRestaurant).length > 1;

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || isBusy) return;

    setErrorMessage(null);
    hasNavigatedRef.current = false;
    isVerifyingRef.current = false;

    const addrId = selectedAddress?.id
      ? parseInt(selectedAddress.id, 10)
      : undefined;

    try {
      setCheckoutState("CREATING_ORDER");

      // ── Build checkout payload ──────────────────────────────────────────────
      // Always use the new /orders/checkout endpoint which handles both single-
      // restaurant and multi-restaurant carts atomically on the backend.
      const checkoutOrders = Object.entries(itemsByRestaurant).map(
        ([rId, items]) => ({
          restaurantId: parseInt(rId, 10) || 1,
          items: items.map((item) => ({
            menuItemId: parseInt(item.menuItemId || item.id, 10) || 1,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions,
          })),
        }),
      );

      const checkoutRes = await ordersApi.checkout({
        orders: checkoutOrders,
        deliveryAddressId: addrId,
        deliveryAddressText: deliveryAddress,
        paymentMethod: paymentMethod === "cod" ? "COD" : paymentMethod.toUpperCase(),
      });

      if (!checkoutRes.success || !checkoutRes.data) {
        throw new Error(checkoutRes.message || "Failed to create orders");
      }

      const { checkoutGroupId: groupId, orderId: primaryId, orderNumber, totalAmount: serverTotal } = checkoutRes.data;
      setCheckoutGroupId(groupId);
      setRealOrderId(String(primaryId));
      setOrderId(orderNumber || String(primaryId));

      // ── Branch: COD or online payment ──────────────────────────────────────
      if (paymentMethod === "cod") {
        setCheckoutState("SUCCESS");
        setOrderPlaced(true);
        dispatch(clearCart());
        dispatch(clearCartServer());
        return;
      }

      // Online payment — initialise Razorpay payment order
      setCheckoutState("CREATING_PAYMENT");
      const paymentOrderRes = await paymentsApi.createPaymentOrder({
        orderId: Number(primaryId),
      });

      if (paymentOrderRes.success && paymentOrderRes.data) {
        setPaymentData(paymentOrderRes.data);
        setCheckoutState("PAYMENT_SHEET");
      } else {
        throw new Error(paymentOrderRes.message || "Failed to initialize payment gateway");
      }
    } catch (err: any) {
      console.error("Order or payment initialization failed:", err);
      setCheckoutState("FAILED");
      const message =
        err?.message ||
        err?.response?.data?.message ||
        "Failed to place order. Your cart items are safe. Please try again.";
      setErrorMessage(message);
      Alert.alert("Checkout Error", message);
    }
  };

  const handleRazorpaySuccess = async (result: RazorpayCheckoutSuccessResult) => {
    // 1. Prevent duplicate processing of the same success callback
    if (isVerifyingRef.current || hasNavigatedRef.current) return;
    if (!realOrderId) return;

    isVerifyingRef.current = true;
    setCheckoutState("VERIFYING");

    try {
      // 2. Submit payment identifiers and cryptographic signature to backend
      const verificationRes = await paymentsApi.verifyPayment({
        orderId: Number(realOrderId),
        providerOrderId: result.providerOrderId,
        providerPaymentId: result.providerPaymentId,
        providerSignature: result.providerSignature,
      });

      if (verificationRes.success) {
        if (!isMountedRef.current) return;

        // 3. Clear cart ONLY after backend verification succeeds
        dispatch(clearCart());
        dispatch(clearCartServer());

        // 4. Safely close payment sheet state
        setCheckoutState("SUCCESS");
        setPaymentData(null);

        // 5. Navigate ONCE to order confirmation screen (OrderDetails)
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          isVerifyingRef.current = false;
          const targetOrderId = realOrderId || orderId;
          setTimeout(() => {
            if (isMountedRef.current) {
              navigation.navigate("OrderDetails", {
                orderId: targetOrderId,
              });
            }
          }, 150);
        }
        return;
      } else {
        throw new Error(verificationRes.message || "Payment verification failed on server");
      }
    } catch (err: any) {
      console.error("Payment verification failed:", err);
      isVerifyingRef.current = false;

      // Fallback reconciliation: Check if webhook confirmed order in the background
      try {
        const orderStatusRes = await ordersApi.getOrderById(Number(realOrderId));
        const orderData = orderStatusRes.data as any;
        if (
          orderStatusRes.success &&
          (orderData?.paymentStatus === "PAID" || orderData?.status === "CONFIRMED")
        ) {
          if (!isMountedRef.current) return;
          dispatch(clearCart());
          dispatch(clearCartServer());
          setCheckoutState("SUCCESS");
          setPaymentData(null);
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            const targetOrderId = realOrderId || orderId;
            setTimeout(() => {
              if (isMountedRef.current) {
                navigation.navigate("OrderDetails", {
                  orderId: targetOrderId,
                });
              }
            }, 150);
          }
          return;
        }
      } catch {
        // Fallback check failed, proceed to pending/incomplete UI
      }

      if (!isMountedRef.current) return;

      // Do NOT mark as paid. Do NOT navigate to success.
      setCheckoutState("FAILED");
      setPaymentData(null);
      const message =
        err?.message ||
        err?.response?.data?.message ||
        "Payment verification could not be completed. Your cart has been preserved.";
      setErrorMessage(message);
      Alert.alert(
        "Verification Pending / Incomplete",
        `${message}\n\nYour order number is #${orderId}. If your account was debited, your order will be confirmed shortly. You can track this order in your Orders list.`,
        [
          {
            text: "View Orders",
            onPress: () => navigation.navigate("Orders"),
          },
          { text: "Dismiss", style: "cancel" },
        ],
      );
    }
  };

  const handlePaymentError = async (error: RazorpayPaymentError) => {
    if (isVerifyingRef.current || hasNavigatedRef.current) return;

    console.warn(
      `[Razorpay Gateway Error] Code: ${error.code || "N/A"}, Description: ${error.description || "N/A"}, Source: ${error.source || "N/A"}, Step: ${error.step || "N/A"}, Reason: ${error.reason || "N/A"}`
    );

    if (paymentData && realOrderId) {
      try {
        await paymentsApi.recordPaymentFailure({
          orderId: Number(realOrderId),
          providerOrderId: paymentData.providerOrderId,
          code: error.code || "PAYMENT_FAILED",
          description: error.description || "Payment failed at checkout gateway",
        });
      } catch (e) {
        console.warn("Failed to report payment failure to backend:", e);
      }
    }
    setCheckoutState("FAILED");
    setPaymentData(null);
    const msg = error.description || "Payment could not be completed. Your cart has been preserved.";
    setErrorMessage(msg);
    Alert.alert("Payment Incomplete", msg);
  };

  const handleCancelPaymentSheet = async () => {
    // If verification is already in flight or succeeded, do NOT cancel
    if (
      isVerifyingRef.current ||
      hasNavigatedRef.current ||
      checkoutState === "VERIFYING" ||
      checkoutState === "SUCCESS"
    ) {
      return;
    }

    if (paymentData && realOrderId) {
      try {
        await paymentsApi.recordPaymentFailure({
          orderId: Number(realOrderId),
          providerOrderId: paymentData.providerOrderId,
          code: "USER_CANCELLED",
          description: "Payment cancelled by customer in checkout sheet",
        });
      } catch (e) {
        // Log silently
        console.warn("Failed to report user cancellation to backend:", e);
      }
    }

    setCheckoutState("IDLE");
    setPaymentData(null);
    setCheckoutGroupId(null);
    setErrorMessage("Payment was cancelled. Your cart items are still saved.");
  };

  const handleOrderSuccessClose = () => {
    setOrderPlaced(false);
    setCheckoutState("IDLE");
    navigation.navigate("Home");
  };

  const handleTrackOrder = () => {
    setOrderPlaced(false);
    setCheckoutState("IDLE");
    navigation.navigate("OrderDetails", {
      orderId: realOrderId || orderId,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <Pressable
          style={[styles.backBtn, { backgroundColor: theme.skeleton }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.icon} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Error / Status Notice */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Ionicons name="information-circle" size={20} color="#DC2626" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Delivery Address Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="location" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Delivery Address
              </Text>
              <Text
                style={[styles.addressText, { color: theme.secondaryText }]}
                numberOfLines={2}
              >
                {deliveryAddress}
              </Text>
            </View>
          </View>
          <View style={styles.deliveryTimeBanner}>
            <Ionicons name="time-outline" size={16} color="#059669" />
            <Text style={styles.deliveryTimeText}>
              Estimated delivery: 25-35 mins
            </Text>
          </View>
        </View>

        {/* Order Summary Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="restaurant" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Order Summary ({totalCount} items)
            </Text>
          </View>

          {cartItems.map((item) => (
            <View
              key={item.id}
              style={[styles.itemRow, { borderBottomColor: theme.border }]}
            >
              <View style={styles.itemLeft}>
                <Text style={[styles.itemQtyBadge, { backgroundColor: theme.primaryLight, color: theme.primary }]}>
                  {item.quantity}x
                </Text>
                <Text
                  style={[styles.itemName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </View>
              <Text style={[styles.itemPrice, { color: theme.text }]}>
                {formatINR(item.price * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        {/* Payment Method Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="card" size={18} color={theme.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Payment Method
            </Text>
          </View>

          {(["cod", "card", "upi"] as const).map((method) => {
            const isActive = paymentMethod === method;
            const infoMap = {
              cod: { icon: "cash-outline" as const, name: "Cash on Delivery", desc: "Pay with cash upon arrival", iconColor: "#059669" },
              card: { icon: "card-outline" as const, name: "Credit or Debit Card", desc: "Razorpay Secure • Visa, MC, Amex", iconColor: "#2563EB" },
              upi: { icon: "phone-portrait-outline" as const, name: "UPI / Instant Pay", desc: "Google Pay, PhonePe, Paytm", iconColor: "#D97706" },
            };
            const info = infoMap[method];

            return (
              <Pressable
                key={method}
                style={[
                  styles.paymentOption,
                  {
                    borderColor: isActive ? theme.primary : theme.border,
                    backgroundColor: isActive ? theme.primaryLight : "transparent",
                  },
                ]}
                disabled={isBusy}
                onPress={() => setPaymentMethod(method)}
              >
                <View style={styles.paymentLeft}>
                  <Ionicons name={info.icon} size={20} color={info.iconColor} />
                  <View>
                    <Text style={[styles.paymentName, { color: theme.text }]}>
                      {info.name}
                    </Text>
                    <Text style={[styles.paymentDesc, { color: theme.muted }]}>
                      {info.desc}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isActive ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={isActive ? theme.primary : theme.muted}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Bill Details */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Bill Details</Text>

          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: theme.muted }]}>Item Total</Text>
            <Text style={[styles.billValue, { color: theme.text }]}>
              {formatINR(totalAmount)}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: theme.muted }]}>Delivery Fee</Text>
            <Text style={[styles.billValue, { color: theme.text }]}>
              {deliveryFee === 0 ? "FREE" : formatINR(deliveryFee)}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: theme.muted }]}>
              Platform &amp; Govt Taxes
            </Text>
            <Text style={[styles.billValue, { color: theme.text }]}>
              {formatINR(taxesAndFees)}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.billRow}>
            <Text style={[styles.grandTotalLabel, { color: theme.text }]}>To Pay</Text>
            <Text style={[styles.grandTotalValue, { color: theme.primary }]}>
              {formatINR(grandTotal)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          style={[
            styles.placeOrderBtn,
            (totalCount === 0 || isBusy) && styles.placeOrderBtnDisabled,
          ]}
          disabled={totalCount === 0 || isBusy}
          onPress={handlePlaceOrder}
        >
          <View>
            <Text style={styles.placeOrderPrice}>{formatINR(grandTotal)}</Text>
            <Text style={styles.placeOrderLabel}>Total Payable</Text>
          </View>
          <View style={styles.placeOrderRight}>
            {isBusy ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.loadingBtnText}>
                  {checkoutState === "CREATING_ORDER"
                    ? "Placing..."
                    : checkoutState === "CREATING_PAYMENT"
                    ? "Connecting..."
                    : "Verifying..."}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.placeOrderText}>
                  {paymentMethod === "cod" ? "Place Order" : "Proceed to Pay"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </View>
        </Pressable>
      </View>

      {/* Real Razorpay Checkout Modal */}
      {paymentData && (
        <RazorpayCheckoutModal
          visible={checkoutState === "PAYMENT_SHEET" || checkoutState === "VERIFYING"}
          isVerifying={checkoutState === "VERIFYING"}
          keyId={paymentData.keyId}
          orderId={realOrderId}
          orderNumber={paymentData.orderNumber || orderId}
          providerOrderId={paymentData.providerOrderId}
          amount={paymentData.amount}
          currency={paymentData.currency}
          prefill={{
            name: currentUser?.name || undefined,
            contact: currentUser?.phone || undefined,
            email: currentUser?.email || undefined,
          }}
          onSuccess={handleRazorpaySuccess}
          onDismiss={handleCancelPaymentSheet}
          onError={handlePaymentError}
        />
      )}

      {/* Order Success Modal */}
      <Modal visible={orderPlaced} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: theme.card }]}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={[styles.successTitle, { color: theme.text }]}>
              {isMultiRestaurant ? "Orders Confirmed!" : "Order Confirmed!"}
            </Text>
            <Text style={[styles.successSubtitle, { color: theme.secondaryText }]}>
              {isMultiRestaurant
                ? paymentMethod === "cod"
                  ? `${Object.keys(itemsByRestaurant).length} orders placed! Pay with cash upon delivery.`
                  : `Payment verified! All ${Object.keys(itemsByRestaurant).length} orders are confirmed and being prepared.`
                : paymentMethod === "cod"
                ? "Your order has been received! Pay with cash upon delivery."
                : "Payment verified successfully! Your order is confirmed and being prepared."}
            </Text>
            <View style={[styles.orderIdBox, { backgroundColor: theme.skeleton }]}>
              <Text style={[styles.orderIdLabel, { color: theme.muted }]}>Order Number</Text>
              <Text style={[styles.orderIdValue, { color: theme.text }]}>{orderId}</Text>
            </View>
            <Pressable style={styles.successBtn} onPress={handleTrackOrder}>
              <Text style={styles.successBtnText}>Track Order</Text>
            </Pressable>
            <Pressable
              style={styles.successSecondaryBtn}
              onPress={handleOrderSuccessClose}
            >
              <Text
                style={[
                  styles.successSecondaryBtnText,
                  { color: theme.secondaryText },
                ]}
              >
                Back to Home
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorBannerText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  addressText: {
    fontSize: 13,
    marginTop: 2,
  },
  deliveryTimeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 6,
  },
  deliveryTimeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  itemQtyBadge: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  paymentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: "600",
  },
  paymentDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  billLabel: {
    fontSize: 13,
  },
  billValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  placeOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#C1121F",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: "#C1121F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  placeOrderBtnDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
  },
  placeOrderPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  placeOrderLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
  },
  placeOrderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  placeOrderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  paymentSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  paymentSheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gatewayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  gatewayBadgeText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
  },
  paymentAmountBox: {
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  paymentAmountLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  paymentAmountValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  paymentGatewayRef: {
    fontSize: 11,
    marginTop: 2,
  },
  sheetDetails: {
    gap: 8,
    paddingVertical: 4,
  },
  sheetDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetDetailLabel: {
    fontSize: 13,
  },
  sheetDetailVal: {
    fontSize: 13,
    fontWeight: "600",
  },
  payNowBtn: {
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payNowBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelPaymentBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelPaymentBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  successCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconCircle: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  orderIdBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  orderIdLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  orderIdValue: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  successBtn: {
    backgroundColor: "#C1121F",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  successBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  successSecondaryBtn: {
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  successSecondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  verifyingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  verifyingCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    gap: 12,
  },
  verifyingTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  verifyingSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
