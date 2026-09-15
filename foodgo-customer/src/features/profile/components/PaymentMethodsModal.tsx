import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../../../store";
import {
  fetchPaymentMethodsThunk,
  addPaymentMethodThunk,
  setDefaultPaymentMethodThunk,
  deletePaymentMethodThunk,
} from "../../../store/slices/paymentSlice";
import { useTheme } from "../../../theme/useTheme";

interface Props {
  visible: boolean;
  closeModal: (value: boolean) => void;
}

type TabType = "CARD" | "UPI";

export default function PaymentMethodsModal({ visible, closeModal }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, isDark } = useTheme();

  const { items, loading, actionLoading, error } = useSelector(
    (state: RootState) => state.payment,
  );

  const [isAdding, setIsAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<TabType>("CARD");

  // Form states
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [upiId, setUpiId] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch payment methods on open
  useEffect(() => {
    if (visible) {
      dispatch(fetchPaymentMethodsThunk());
      setIsAdding(false);
      resetForm();
    }
  }, [visible, dispatch]);

  const resetForm = () => {
    setCardHolder("");
    setCardNumber("");
    setCardExpiry("");
    setUpiId("");
    setIsDefault(items.length === 0);
    setFormError(null);
  };

  const handleAddPayment = async () => {
    setFormError(null);

    if (selectedType === "CARD") {
      const sanitized = cardNumber.replace(/\s+/g, "");
      if (sanitized.length < 4) {
        setFormError("Please enter a valid card number");
        return;
      }
      const last4 = sanitized.slice(-4);
      const maskedIdentifier = `•••• ${last4}`;

      const resultAction = await dispatch(
        addPaymentMethodThunk({
          type: "CARD",
          maskedIdentifier,
          provider: "STRIPE",
          isDefault,
        }),
      );

      if (addPaymentMethodThunk.fulfilled.match(resultAction)) {
        setIsAdding(false);
        resetForm();
      } else {
        setFormError(
          (resultAction.payload as string) || "Failed to add payment method",
        );
      }
    } else {
      const trimmedUpi = upiId.trim();
      if (!trimmedUpi || !trimmedUpi.includes("@")) {
        setFormError("Please enter a valid UPI ID (e.g. user@bank)");
        return;
      }

      const resultAction = await dispatch(
        addPaymentMethodThunk({
          type: "UPI",
          maskedIdentifier: trimmedUpi,
          provider: "MANUAL",
          isDefault,
        }),
      );

      if (addPaymentMethodThunk.fulfilled.match(resultAction)) {
        setIsAdding(false);
        resetForm();
      } else {
        setFormError(
          (resultAction.payload as string) || "Failed to add UPI ID",
        );
      }
    }
  };

  const handleSetDefault = (id: string) => {
    dispatch(setDefaultPaymentMethodThunk(id));
  };

  const handleRemove = (id: string, identifier: string) => {
    Alert.alert(
      "Remove Payment Method",
      `Are you sure you want to remove ${identifier}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => dispatch(deletePaymentMethodThunk(id)),
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => closeModal(false)}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: isDark ? "#333" : "#F3F4F6" },
            ]}
          >
            <Pressable
              onPress={() => {
                if (isAdding) {
                  setIsAdding(false);
                } else {
                  closeModal(false);
                }
              }}
              hitSlop={12}
              style={styles.backButton}
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={theme.text}
              />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>
              Payment Methods
            </Text>
            <View style={{ width: 30 }} />
          </View>

          {/* Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#C1121F" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {!isAdding ? (
              // ─── LIST VIEW ─────────────────────────────────────────────
              <>
                {loading ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#C1121F" />
                    <Text
                      style={[
                        styles.loadingText,
                        { color: theme.secondaryText },
                      ]}
                    >
                      Loading payment methods...
                    </Text>
                  </View>
                ) : items.length === 0 ? (
                  <View style={styles.centerContainer}>
                    <Ionicons
                      name="card-outline"
                      size={54}
                      color={theme.secondaryText}
                    />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>
                      No Payment Methods
                    </Text>
                    <Text
                      style={[
                        styles.emptySubtitle,
                        { color: theme.secondaryText },
                      ]}
                    >
                      Add a Credit/Debit card or UPI ID for seamless checkout.
                    </Text>
                  </View>
                ) : (
                  items.map((method) => {
                    const isCard = method.type === "CARD";
                    return (
                      <View
                        key={method.id}
                        style={[
                          styles.card,
                          {
                            backgroundColor: isDark ? "#222" : "#FFFFFF",
                            borderColor: isDark ? "#333" : "#F0F0F0",
                          },
                          method.isDefault && styles.defaultCardBorder,
                        ]}
                      >
                        {/* Top Row */}
                        <View style={styles.cardTopRow}>
                          <View
                            style={[
                              styles.iconBox,
                              { backgroundColor: isDark ? "#3B1818" : "#FEE2E2" },
                            ]}
                          >
                            <Ionicons
                              name={isCard ? "card" : "business"}
                              size={20}
                              color="#C1121F"
                            />
                          </View>

                          <View style={styles.cardDetails}>
                            <Text
                              style={[styles.cardTitle, { color: theme.text }]}
                            >
                              {isCard ? "Credit Card" : "UPI"}
                            </Text>
                            <Text
                              style={[
                                styles.cardIdentifier,
                                { color: theme.secondaryText },
                              ]}
                            >
                              {method.maskedIdentifier}
                            </Text>
                          </View>

                          {method.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>
                                Default
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Divider */}
                        <View
                          style={[
                            styles.cardDivider,
                            { backgroundColor: isDark ? "#333" : "#F5F5F5" },
                          ]}
                        />

                        {/* Bottom Actions Row */}
                        <View style={styles.cardBottomRow}>
                          {!method.isDefault ? (
                            <Pressable
                              onPress={() => handleSetDefault(method.id)}
                              disabled={actionLoading}
                              hitSlop={8}
                            >
                              <Text style={styles.setDefaultText}>
                                Set Default
                              </Text>
                            </Pressable>
                          ) : (
                            <View />
                          )}

                          <Pressable
                            onPress={() =>
                              handleRemove(method.id, method.maskedIdentifier)
                            }
                            disabled={actionLoading}
                            hitSlop={8}
                          >
                            <Text style={styles.removeText}>Remove</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            ) : (
              // ─── ADD PAYMENT METHOD FORM ──────────────────────────────
              <View style={styles.formContainer}>
                {/* Method Switcher */}
                <View
                  style={[
                    styles.tabContainer,
                    { backgroundColor: isDark ? "#2A2A2A" : "#F3F4F6" },
                  ]}
                >
                  <Pressable
                    style={[
                      styles.tabButton,
                      selectedType === "CARD" && styles.activeTabButton,
                    ]}
                    onPress={() => {
                      setSelectedType("CARD");
                      setFormError(null);
                    }}
                  >
                    <Ionicons
                      name="card-outline"
                      size={16}
                      color={selectedType === "CARD" ? "#fff" : theme.secondaryText}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        selectedType === "CARD"
                          ? styles.activeTabText
                          : { color: theme.secondaryText },
                      ]}
                    >
                      Credit/Debit Card
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.tabButton,
                      selectedType === "UPI" && styles.activeTabButton,
                    ]}
                    onPress={() => {
                      setSelectedType("UPI");
                      setFormError(null);
                    }}
                  >
                    <Ionicons
                      name="business-outline"
                      size={16}
                      color={selectedType === "UPI" ? "#fff" : theme.secondaryText}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        selectedType === "UPI"
                          ? styles.activeTabText
                          : { color: theme.secondaryText },
                      ]}
                    >
                      UPI ID
                    </Text>
                  </Pressable>
                </View>

                {formError && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#C1121F" />
                    <Text style={styles.errorBannerText}>{formError}</Text>
                  </View>
                )}

                {selectedType === "CARD" ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>
                        Cardholder Name
                      </Text>
                      <TextInput
                        value={cardHolder}
                        onChangeText={setCardHolder}
                        placeholder="John Doe"
                        placeholderTextColor={theme.secondaryText}
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            borderColor: isDark ? "#444" : "#E5E7EB",
                            backgroundColor: isDark ? "#2A2A2A" : "#FAFAFA",
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>
                        Card Number
                      </Text>
                      <TextInput
                        value={cardNumber}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/\D/g, "").slice(0, 16);
                          const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
                          setCardNumber(formatted);
                        }}
                        placeholder="1234 5678 9012 3456"
                        placeholderTextColor={theme.secondaryText}
                        keyboardType="number-pad"
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            borderColor: isDark ? "#444" : "#E5E7EB",
                            backgroundColor: isDark ? "#2A2A2A" : "#FAFAFA",
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>
                        Expiry (MM/YY)
                      </Text>
                      <TextInput
                        value={cardExpiry}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/\D/g, "").slice(0, 4);
                          if (cleaned.length >= 3) {
                            setCardExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
                          } else {
                            setCardExpiry(cleaned);
                          }
                        }}
                        placeholder="12/28"
                        placeholderTextColor={theme.secondaryText}
                        keyboardType="number-pad"
                        maxLength={5}
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            borderColor: isDark ? "#444" : "#E5E7EB",
                            backgroundColor: isDark ? "#2A2A2A" : "#FAFAFA",
                          },
                        ]}
                      />
                    </View>
                  </>
                ) : (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>
                      UPI ID
                    </Text>
                    <TextInput
                      value={upiId}
                      onChangeText={setUpiId}
                      placeholder="username@okhdfcbank"
                      placeholderTextColor={theme.secondaryText}
                      autoCapitalize="none"
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          borderColor: isDark ? "#444" : "#E5E7EB",
                          backgroundColor: isDark ? "#2A2A2A" : "#FAFAFA",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.helperText,
                        { color: theme.secondaryText },
                      ]}
                    >
                      Supports Google Pay, PhonePe, Paytm, and other BHIM UPI IDs.
                    </Text>
                  </View>
                )}

                {/* Default Toggle */}
                <View style={styles.defaultRow}>
                  <Text style={[styles.defaultLabel, { color: theme.text }]}>
                    Set as default payment method
                  </Text>
                  <Switch
                    value={isDefault}
                    onValueChange={setIsDefault}
                    trackColor={{ false: "#D1D5DB", true: "#C1121F" }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Save New Button */}
                <Pressable
                  style={[
                    styles.primaryButton,
                    actionLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleAddPayment}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Save Payment Method
                    </Text>
                  )}
                </Pressable>

                {/* Cancel Add */}
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setIsAdding(false)}
                  disabled={actionLoading}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.primary }]}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Bottom Button (Only shown in list view) */}
          {!isAdding && (
            <View style={styles.bottomBar}>
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  setIsAdding(true);
                  resetForm();
                }}
              >
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.primaryButtonText}>Add Payment Method</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorBannerText: {
    color: "#C1121F",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },

  // ─── CARD STYLING ──────────────────────────────────────────────────────────
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  defaultCardBorder: {
    borderLeftWidth: 4,
    borderLeftColor: "#C1121F",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardDetails: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardIdentifier: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  defaultBadge: {
    backgroundColor: "#FDE8E8",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  defaultBadgeText: {
    color: "#C1121F",
    fontSize: 11,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  setDefaultText: {
    color: "#C1121F",
    fontSize: 13,
    fontWeight: "600",
  },
  removeText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
  },

  // ─── FORM STYLING ──────────────────────────────────────────────────────────
  formContainer: {
    paddingTop: 6,
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: "#C1121F",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 14,
  },
  defaultLabel: {
    fontSize: 14,
    fontWeight: "600",
  },

  // ─── BUTTONS ───────────────────────────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  primaryButton: {
    height: 48,
    backgroundColor: "#B91C1C",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
