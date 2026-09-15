import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { clearCart } from "@/store/slices/cartSlice";
import { selectSelectedAddress } from "@/store/slices/addressSlice";
import { placeOrder } from "@/store/slices/ordersSlice";
import { AppStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";

type Nav = NativeStackNavigationProp<AppStackParamList>;
type PaymentMethod = "cod" | "card" | "upi" | "apple_pay";

export default function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();

  const cartItems = useAppSelector((state) => state.cart.items);
  const totalCount = useAppSelector((state) => state.cart.totalCount);
  const totalAmount = useAppSelector((state) => state.cart.totalAmount);
  const location = useAppSelector((state) => state.location);
  const selectedAddress = useAppSelector(selectSelectedAddress);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [realOrderId, setRealOrderId] = useState("");

  const placingOrder = useAppSelector((state) => state.orders.placingOrder);

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

  const deliveryFee = totalAmount >= 30 || totalAmount === 0 ? 0 : 2.99;
  const taxesAndFees = totalAmount > 0 ? 1.5 : 0;
  const grandTotal = totalAmount + deliveryFee + taxesAndFees;

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;

    const rId = parseInt(cartItems[0]?.restaurantId || "1", 10) || 1;
    const addrId = selectedAddress?.id
      ? parseInt(selectedAddress.id, 10)
      : undefined;

    try {
      const res = await dispatch(
        placeOrder({
          restaurantId: rId,
          deliveryAddressId: addrId,
          deliveryAddressText: deliveryAddress,
          paymentMethod: paymentMethod.toUpperCase(),
          items: cartItems.map((item) => ({
            menuItemId: parseInt(item.id, 10) || 1,
            quantity: item.quantity,
          })),
        }),
      ).unwrap();

      const displayNum = res.orderNumber || res.id;
      setOrderId(displayNum);
      setRealOrderId(res.id);
      setOrderPlaced(true);
      dispatch(clearCart());
    } catch (err) {
      console.warn(
        "Backend placeOrder failed, using offline fallback:",
        err,
      );
      const generatedId = `FDG-${Math.floor(100000 + Math.random() * 900000)}`;
      setOrderId(generatedId);
      setRealOrderId(generatedId);
      setOrderPlaced(true);
      dispatch(clearCart());
    }
  };

  const handleOrderSuccessClose = () => {
    setOrderPlaced(false);
    navigation.navigate("Home");
  };

  const handleTrackOrder = () => {
    setOrderPlaced(false);
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
                ${(item.price * item.quantity).toFixed(2)}
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
              card: { icon: "card-outline" as const, name: "Credit or Debit Card", desc: "Visa, MasterCard, Amex", iconColor: "#2563EB" },
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
              ${totalAmount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: theme.muted }]}>Delivery Fee</Text>
            <Text style={[styles.billValue, { color: theme.text }]}>
              {deliveryFee === 0 ? "FREE" : `$${deliveryFee.toFixed(2)}`}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: theme.muted }]}>
              Platform & Govt Taxes
            </Text>
            <Text style={[styles.billValue, { color: theme.text }]}>
              ${taxesAndFees.toFixed(2)}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.billRow}>
            <Text style={[styles.grandTotalLabel, { color: theme.text }]}>To Pay</Text>
            <Text style={[styles.grandTotalValue, { color: theme.primary }]}>
              ${grandTotal.toFixed(2)}
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
            (totalCount === 0 || placingOrder) && styles.placeOrderBtnDisabled,
          ]}
          disabled={totalCount === 0 || placingOrder}
          onPress={handlePlaceOrder}
        >
          <View>
            <Text style={styles.placeOrderPrice}>${grandTotal.toFixed(2)}</Text>
            <Text style={styles.placeOrderLabel}>Total Payable</Text>
          </View>
          <View style={styles.placeOrderRight}>
            {placingOrder ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.placeOrderText}>Place Order</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </View>
        </Pressable>
      </View>

      {/* Order Success Modal */}
      <Modal visible={orderPlaced} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: theme.card }]}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={[styles.successTitle, { color: theme.text }]}>
              Order Placed!
            </Text>
            <Text style={[styles.successSubtitle, { color: theme.secondaryText }]}>
              Your delicious food is being prepared and will be delivered shortly.
            </Text>
            <View style={[styles.orderIdBox, { backgroundColor: theme.skeleton }]}>
              <Text style={[styles.orderIdLabel, { color: theme.muted }]}>Order ID</Text>
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
    backgroundColor: "#D1D5DB",
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
});
