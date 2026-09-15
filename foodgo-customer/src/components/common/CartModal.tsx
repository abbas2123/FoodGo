import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  addToCart,
  decrementQuantity,
  removeFromCart,
  clearCart,
} from "@/store/slices/cartSlice";

interface CartModalProps {
  visible: boolean;
  onClose: () => void;
  onCheckout?: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({
  visible,
  onClose,
  onCheckout,
}) => {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector((state) => state.cart.items);
  const totalCount = useAppSelector((state) => state.cart.totalCount);
  const totalAmount = useAppSelector((state) => state.cart.totalAmount);
  const location = useAppSelector((state) => state.location);
  console.log("cartItems:", cartItems);
  const deliveryAddress =
    location.formattedAddress ||
    location.displayLocation ||
    location.city ||
    "Current Location";

  const deliveryFee = totalAmount >= 30 || totalAmount === 0 ? 0 : 2.99;
  const taxesAndFees = totalAmount > 0 ? 1.5 : 0;
  const grandTotal = totalAmount + deliveryFee + taxesAndFees;

  const handleIncrement = (item: (typeof cartItems)[0]) => {
    dispatch(
      addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        restaurantId: item.restaurantId,
        quantity: 1,
      }),
    );
  };

  const handleDecrement = (itemId: string) => {
    dispatch(decrementQuantity(itemId));
  };

  const handleRemove = (itemId: string) => {
    dispatch(removeFromCart(itemId));
  };

  const handleClear = () => {
    dispatch(clearCart());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.cartIconBadge}>
                <Ionicons name="cart" size={18} color="#C1121F" />
              </View>
              <Text style={styles.headerTitle}>My Cart</Text>
              {totalCount > 0 && (
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{totalCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.headerActions}>
              {totalCount > 0 && (
                <Pressable onPress={handleClear} style={styles.clearBtn}>
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>
          </View>

          {/* Address Bar */}
          <View style={styles.addressBar}>
            <Ionicons name="location-sharp" size={16} color="#C1121F" />
            <Text style={styles.addressLabel}>Delivering to:</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {deliveryAddress}
            </Text>
          </View>

          {/* Body */}
          {totalCount === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="cart-outline" size={48} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptySubtitle}>
                Explore your favorite restaurants and add delicious meals to
                start an order!
              </Text>
              <Pressable style={styles.browseBtn} onPress={onClose}>
                <Text style={styles.browseBtnText}>Browse Restaurants</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.itemsScroll}
                contentContainerStyle={styles.itemsContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Items List */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Items Ordered</Text>
                </View>

                {cartItems.map((item) => (
                  <View key={item.id} style={styles.cartItemRow}>
                    {/* Item Image or Placeholder */}
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.itemImage}
                      />
                    ) : (
                      <View style={styles.itemImagePlaceholder}>
                        <Ionicons
                          name="fast-food-outline"
                          size={20}
                          color="#9CA3AF"
                        />
                      </View>
                    )}

                    {/* Info */}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>
                        ${item.price.toFixed(2)} each
                      </Text>
                    </View>

                    {/* Stepper Controls */}
                    <View style={styles.stepperContainer}>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => handleDecrement(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="remove" size={16} color="#C1121F" />
                      </Pressable>
                      <Text style={styles.stepperQty}>{item.quantity}</Text>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => handleIncrement(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="add" size={16} color="#C1121F" />
                      </Pressable>
                    </View>

                    {/* Item Subtotal & Delete */}
                    <View style={styles.itemRight}>
                      <Text style={styles.itemSubtotal}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </Text>
                      <Pressable
                        onPress={() => handleRemove(item.id)}
                        style={styles.deleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={14}
                          color="#9CA3AF"
                        />
                      </Pressable>
                    </View>
                  </View>
                ))}

                {/* Bill Breakdown */}
                <View style={styles.billCard}>
                  <Text style={styles.billTitle}>Bill Summary</Text>

                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Item Total</Text>
                    <Text style={styles.billValue}>
                      ${totalAmount.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.billRow}>
                    <View style={styles.feeLabelRow}>
                      <Text style={styles.billLabel}>Delivery Fee</Text>
                      {deliveryFee === 0 && (
                        <View style={styles.freeBadge}>
                          <Text style={styles.freeBadgeText}>FREE</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.billValue,
                        deliveryFee === 0 && styles.freeText,
                      ]}
                    >
                      {deliveryFee === 0
                        ? "$0.00"
                        : `$${deliveryFee.toFixed(2)}`}
                    </Text>
                  </View>

                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Taxes & Fees</Text>
                    <Text style={styles.billValue}>
                      ${taxesAndFees.toFixed(2)}
                    </Text>
                  </View>

                  {deliveryFee > 0 && (
                    <View style={styles.freeDeliveryHint}>
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color="#059669"
                      />
                      <Text style={styles.freeDeliveryText}>
                        Add ${(30 - totalAmount).toFixed(2)} more for FREE
                        delivery!
                      </Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Grand Total</Text>
                    <Text style={styles.totalValue}>
                      ${grandTotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Bottom Checkout CTA */}
              <View style={styles.footer}>
                <Pressable
                  style={styles.checkoutBtn}
                  onPress={onCheckout || onClose}
                >
                  <View style={styles.btnPriceWrapper}>
                    <Text style={styles.btnQty}>
                      {totalCount} {totalCount === 1 ? "item" : "items"}
                    </Text>
                    <Text style={styles.btnPrice}>
                      ${grandTotal.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.btnActionWrapper}>
                    <Text style={styles.btnText}>Proceed to Checkout</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: "#C1121F",
  },
  countPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#FEE2E2",
  },
  clearText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  addressBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#FEF2F2",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#FEE2E2",
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#991B1B",
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    color: "#7F1D1D",
  },
  itemsScroll: {
    flexShrink: 1,
  },
  itemsContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cartItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  itemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 13,
    color: "#6B7280",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtn: {
    padding: 4,
  },
  stepperQty: {
    fontSize: 14,
    fontWeight: "700",
    color: "#C1121F",
    minWidth: 22,
    textAlign: "center",
  },
  itemRight: {
    alignItems: "flex-end",
    minWidth: 55,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  deleteBtn: {
    marginTop: 4,
    padding: 2,
  },
  billCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  billTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  feeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  billLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  billValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
  },
  freeBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  freeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  freeText: {
    color: "#059669",
  },
  freeDeliveryHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  freeDeliveryText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#059669",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#C1121F",
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#C1121F",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: "#C1121F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  btnPriceWrapper: {
    alignItems: "flex-start",
  },
  btnQty: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
  },
  btnPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  btnActionWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyContainer: {
    paddingHorizontal: 30,
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  browseBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#C1121F",
  },
  browseBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
