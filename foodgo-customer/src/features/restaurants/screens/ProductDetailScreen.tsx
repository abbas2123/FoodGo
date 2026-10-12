import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  TextInput,
  StatusBar,
  useWindowDimensions,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppStackParamList } from "@/navigation/types";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  addCartItemServer,
  addToCart,
  clearCart,
  clearCartServer,
} from "@/store/slices/cartSlice";
import { addFavorite, removeFavorite } from "@/store/slices/favoritesSlice";
import { formatINR } from "@/utils/currency";
import { useTheme } from "@/theme/useTheme";
type ProductDetailRouteProp = RouteProp<AppStackParamList, "ProductDetails">;

interface SizeOption {
  id: string;
  name: string;
  priceDelta: number;
}

interface ExtraOption {
  id: string;
  name: string;
  price: number;
}

const SIZE_OPTIONS: SizeOption[] = [
  { id: "regular", name: "Regular", priceDelta: 0 },
  { id: "large", name: "Large", priceDelta: 60 },
];

const EXTRA_OPTIONS: ExtraOption[] = [
  { id: "cheese", name: "Extra Cheese", price: 40 },
  { id: "patty", name: "Extra Patty", price: 120 },
  { id: "bacon", name: "Crispy Bacon", price: 60 },
  { id: "jalapenos", name: "Jalapeños", price: 25 },
];

export const ProductDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<ProductDetailRouteProp>();
  const dispatch = useAppDispatch();

  const { dish, restaurantId, restaurantName } = route.params;

  // Base price extraction
  const rawPrice = Number(dish.price) || 249;
  const isVeg = dish.isVeg ?? false;
  const rating = dish.rating || 4.8;
  const reviews = dish.reviews || "200+";
  const dishName = dish.name || "Classic Smash Burger";
  const description =
    dish.description ||
    "Double smashed beef patties, melted cheddar, lettuce, tomato, pickles and our signature sauce.";
  const imageUri =
    dish.image ||
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80";

  // State
  const [selectedSize, setSelectedSize] = useState<string>("regular");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);

  // Favorites from store if restaurantId is provided
  const favoriteItems = useAppSelector((state) => state.favorites.items);
  const isRestaurantFavorited = restaurantId
    ? favoriteItems.some(
        (f) => String(f.restaurant?.id) === String(restaurantId),
      )
    : false;

  const activeFavorited = restaurantId ? isRestaurantFavorited : isFavorite;

  const toggleFavorite = () => {
    if (restaurantId) {
      if (isRestaurantFavorited) {
        dispatch(removeFavorite(restaurantId));
      } else {
        dispatch(addFavorite(restaurantId));
      }
    } else {
      setIsFavorite((prev) => !prev);
    }
  };

  // Toggle Extra
  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Pricing calculations
  const sizeDelta =
    SIZE_OPTIONS.find((s) => s.id === selectedSize)?.priceDelta || 0;
  const extrasTotal = selectedExtras.reduce((sum, extraId) => {
    const extra = EXTRA_OPTIONS.find((e) => e.id === extraId);
    return sum + (extra ? extra.price : 0);
  }, 0);

  const unitPrice = rawPrice + sizeDelta + extrasTotal;
  const totalPrice = unitPrice * quantity;

  const cartRestaurantId = useAppSelector((state) => state.cart.restaurantId);
  const cartItems = useAppSelector((state) => state.cart.items);

  // Add to cart handler
  const handleAddToCart = async () => {
    const targetRestaurantId = restaurantId ? String(restaurantId) : "1";

    if (
      cartRestaurantId &&
      cartItems.length > 0 &&
      String(cartRestaurantId) !== targetRestaurantId
    ) {
      Alert.alert(
        "Replace cart items?",
        "Your cart contains dishes from another restaurant. Do you want to clear your cart and start a fresh order from this restaurant?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear & Add",
            style: "destructive",
            onPress: async () => {
              await dispatch(clearCartServer()).unwrap();
              dispatch(clearCart());
              await executeAddToCart();
            },
          },
        ],
      );
      return;
    }

    await executeAddToCart();
  };

  const executeAddToCart = async () => {
    const selectedSizeObj = SIZE_OPTIONS.find((s) => s.id === selectedSize);
    const selectedExtrasNames = selectedExtras
      .map((id) => EXTRA_OPTIONS.find((e) => e.id === id)?.name)
      .filter(Boolean);

    let fullInstructions = "";
    if (selectedSizeObj && selectedSizeObj.id !== "regular") {
      fullInstructions += `Size: ${selectedSizeObj.name}. `;
    }
    if (selectedExtrasNames.length > 0) {
      fullInstructions += `Extras: ${selectedExtrasNames.join(", ")}. `;
    }
    if (specialInstructions.trim()) {
      fullInstructions += `Note: ${specialInstructions.trim()}`;
    }

    const targetRestaurantId = restaurantId ? String(restaurantId) : "1";
    const payload = {
      menuItemId: String(dish.id),
      name: `${dishName}${selectedSize === "large" ? " (Large)" : ""}`,
      price: unitPrice,
      quantity,
      image: imageUri,
      restaurantId: targetRestaurantId,
      specialInstructions: fullInstructions.trim() || undefined,
    };

    // Optimistic Redux state update
    dispatch(
      addToCart({
        id: String(dish.id),
        name: payload.name,
        price: payload.price,
        quantity: payload.quantity,
        image: payload.image,
        restaurantId: payload.restaurantId,
      }),
    );

    // Backend persistent call
    try {
      await dispatch(
        addCartItemServer({
          menuItemId: Number(dish.id) || 1,
          quantity,
          specialInstructions: payload.specialInstructions,
        }),
      ).unwrap();
    } catch {
      // Handled silently by slice or fallback
    }

    setAddedSuccess(true);
    setTimeout(() => {
      navigation.goBack();
    }, 450);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 140 },
        ]}
      >
        {/* Hero Image Section */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.heroImage} />

          {/* Floating Back Button */}
          <Pressable
            style={[
              styles.floatingBtn,
              styles.backBtn,
              {
                top: insets.top + 10,
                backgroundColor: isDark ? theme.surface : "#FFFFFF",
                borderColor: theme.border,
                borderWidth: isDark ? 1 : 0,
              },
            ]}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>

          {/* Floating Favorite Button */}
          <Pressable
            style={[
              styles.floatingBtn,
              styles.favBtn,
              {
                top: insets.top + 10,
                backgroundColor: isDark ? theme.surface : "#FFFFFF",
                borderColor: theme.border,
                borderWidth: isDark ? 1 : 0,
              },
            ]}
            onPress={toggleFavorite}
            hitSlop={10}
          >
            <Ionicons
              name={activeFavorited ? "heart" : "heart-outline"}
              size={22}
              color="#C1121F"
            />
          </Pressable>

          {/* Photo specs metadata badge */}
          <View
            style={[
              styles.metaBadge,
              {
                backgroundColor: isDark
                  ? "rgba(30, 30, 30, 0.85)"
                  : "rgba(255, 255, 255, 0.75)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.15)"
                  : "rgba(255, 255, 255, 0.4)",
              },
            ]}
          >
            <Text
              style={[
                styles.metaBadgeText,
                { color: isDark ? "#E5E7EB" : "#4B5563" },
              ]}
            >
              f/5.6 1/250 sec ISO 200 50mm
            </Text>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          {/* Tag & Rating & Price Row */}
          <View style={styles.topInfoRow}>
            <View style={styles.tagRatingContainer}>
              <View style={styles.vegTagRow}>
                <View
                  style={[
                    styles.vegIconBox,
                    { borderColor: isVeg ? "#16A34A" : "#DC2626" },
                  ]}
                >
                  <View
                    style={[
                      styles.vegIconDot,
                      { backgroundColor: isVeg ? "#16A34A" : "#DC2626" },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.vegTagText,
                    {
                      color: isVeg
                        ? "#16A34A"
                        : isDark
                          ? theme.muted
                          : "#6B7280",
                    },
                  ]}
                >
                  {isVeg ? "Veg" : "Non-veg"}
                </Text>
              </View>

              <Text style={[styles.dotSeparator, { color: theme.muted }]}>•</Text>

              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#FBBF24" />
                <Text
                  style={[
                    styles.ratingText,
                    { color: theme.secondaryText },
                  ]}
                >
                  {rating} ({reviews} reviews)
                </Text>
              </View>
            </View>

            <Text style={styles.priceText}>{formatINR(unitPrice)}</Text>
          </View>

          {/* Dish Title */}
          <Text style={[styles.dishTitle, { color: theme.text }]}>
            {dishName}
          </Text>

          {/* Description */}
          <Text
            style={[
              styles.dishDescription,
              { color: theme.secondaryText },
            ]}
          >
            {description}
          </Text>

          {/* Section: Choose Your Size */}
          <View
            style={[
              styles.cardSection,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Choose Your Size
            </Text>
            {SIZE_OPTIONS.map((option) => {
              const isSelected = selectedSize === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[
                    styles.optionRow,
                    { borderBottomColor: theme.border },
                  ]}
                  onPress={() => setSelectedSize(option.id)}
                >
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor: isSelected
                            ? theme.primary
                            : isDark
                              ? "#4B5563"
                              : "#D1D5DB",
                          backgroundColor: isDark
                            ? theme.surface
                            : "transparent",
                        },
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.optionLabel,
                        {
                          color: isSelected
                            ? theme.text
                            : theme.secondaryText,
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                    >
                      {option.name}
                    </Text>
                  </View>

                  {option.priceDelta > 0 && (
                    <Text
                      style={[
                        styles.optionPrice,
                        { color: theme.secondaryText },
                      ]}
                    >
                      +{formatINR(option.priceDelta)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Section: Add Extras */}
          <View
            style={[
              styles.cardSection,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Add Extras
              </Text>
              <View
                style={[
                  styles.optionalBadge,
                  { backgroundColor: isDark ? theme.primaryLight : "#FEE2E2" },
                ]}
              >
                <Text
                  style={[
                    styles.optionalBadgeText,
                    { color: theme.primary },
                  ]}
                >
                  Optional
                </Text>
              </View>
            </View>

            {EXTRA_OPTIONS.map((extra) => {
              const isChecked = selectedExtras.includes(extra.id);
              return (
                <Pressable
                  key={extra.id}
                  style={[
                    styles.optionRow,
                    { borderBottomColor: theme.border },
                  ]}
                  onPress={() => toggleExtra(extra.id)}
                >
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isChecked
                            ? theme.primary
                            : isDark
                              ? "#4B5563"
                              : "#D1D5DB",
                          backgroundColor: isChecked
                            ? theme.primary
                            : isDark
                              ? theme.surface
                              : "#fff",
                        },
                      ]}
                    >
                      {isChecked && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.optionLabel,
                        {
                          color: isChecked
                            ? theme.text
                            : theme.secondaryText,
                          fontWeight: isChecked ? "700" : "500",
                        },
                      ]}
                    >
                      {extra.name}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.optionPrice,
                      { color: theme.secondaryText },
                    ]}
                  >
                    +{formatINR(extra.price)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Section: Special Instructions */}
          <View
            style={[
              styles.cardSection,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Special Instructions
            </Text>
            <TextInput
              style={[
                styles.specialInput,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Add notes (e.g. no onions, sauce on the side)..."
              placeholderTextColor={theme.muted}
              multiline
              numberOfLines={3}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
            />
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            borderTopWidth: isDark ? 1 : 0,
          },
        ]}
      >
        {/* Quantity Stepper Pill */}
        <View style={styles.stepperContainer}>
          <View
            style={[
              styles.stepperPill,
              { backgroundColor: isDark ? theme.card : "#F3F4F6" },
            ]}
          >
            <Pressable
              style={[
                styles.stepBtn,
                {
                  backgroundColor: isDark ? theme.surface : "#FFFFFF",
                },
              ]}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              hitSlop={8}
            >
              <Ionicons name="remove" size={18} color={theme.text} />
            </Pressable>

            <Text style={[styles.stepQtyText, { color: theme.text }]}>
              {quantity}
            </Text>

            <Pressable
              style={[
                styles.stepBtn,
                {
                  backgroundColor: isDark ? theme.surface : "#FFFFFF",
                },
              ]}
              onPress={() => setQuantity((q) => q + 1)}
              hitSlop={8}
            >
              <Ionicons name="add" size={18} color={theme.text} />
            </Pressable>
          </View>
        </View>

        {/* Big Red Add to Cart Button */}
        <Pressable
          style={({ pressed }) => [
            styles.addToCartBtn,
            pressed && { opacity: 0.9 },
            addedSuccess && styles.addToCartSuccess,
          ]}
          onPress={handleAddToCart}
        >
          <Ionicons
            name={addedSuccess ? "checkmark-circle" : "cart"}
            size={22}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.addToCartText}>
            {addedSuccess
              ? "Added to Cart!"
              : `Add to Cart • ${formatINR(totalPrice)}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollContent: {
    paddingBottom: 150,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 330,
    backgroundColor: "#E5E7EB",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  floatingBtn: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  backBtn: {
    left: 20,
  },
  favBtn: {
    right: 20,
  },
  metaBadge: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  metaBadgeText: {
    fontSize: 11,
    color: "#4B5563",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  contentBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  topInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tagRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vegTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vegIconBox: {
    width: 15,
    height: 15,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  vegIconDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  vegTagText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dotSeparator: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  priceText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#C1121F",
  },
  dishTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginTop: -4,
  },
  dishDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
  },
  cardSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  optionalBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionalBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#C1121F",
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: "#C1121F",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#C1121F",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#C1121F",
    borderColor: "#C1121F",
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  optionLabelSelected: {
    fontWeight: "600",
    color: "#111827",
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  specialInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    minHeight: 84,
    textAlignVertical: "top",
    fontSize: 14,
    color: "#1F2937",
    marginTop: 4,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    alignItems: "center",
  },
  stepperContainer: {
    marginBottom: 10,
  },
  stepperPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 16,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stepQtyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    minWidth: 18,
    textAlign: "center",
  },
  addToCartBtn: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "#C1121F",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  addToCartSuccess: {
    backgroundColor: "#16A34A",
  },
  addToCartText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default ProductDetailScreen;
