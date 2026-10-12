import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  addToCart,
  decrementQuantity,
  clearCart,
  clearCartServer,
  addCartItemServer,
  updateCartItemQuantityServer,
  removeCartItemServer,
} from "@/store/slices/cartSlice";
import { fetchRestaurantById } from "@/store/slices/restaurantsSlice";
import {
  addFavorite,
  removeFavorite,
  checkFavoriteStatus,
} from "@/store/slices/favoritesSlice";
import { AppStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import { MenuItem } from "../types";
import {
  RestaurantStickyHeader,
  RestaurantHeroBanner,
  RestaurantInfoCard,
  CategoryTabs,
  MenuItemCard,
} from "../components";

type RestaurantDetailRouteProp = RouteProp<
  AppStackParamList,
  "RestaurantDetails"
>;
type RestaurantDetailNavProp = NativeStackNavigationProp<AppStackParamList>;

const BANNER_HEIGHT = 240;

export default function RestaurantDetailScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<RestaurantDetailNavProp>();
  const route = useRoute<RestaurantDetailRouteProp>();
  const dispatch = useAppDispatch();

  const restaurantId = route.params?.id ?? "1";
  const storeRestaurant = useAppSelector(
    (state) => state.restaurants.currentRestaurant,
  );
  const loading = useAppSelector((state) => state.restaurants.loading);
  const error = useAppSelector((state) => state.restaurants.error);

  const isCurrentRestaurant =
    storeRestaurant && String(storeRestaurant.id) === String(restaurantId);
  const restaurant = isCurrentRestaurant ? storeRestaurant : null;

  const cartItems = useAppSelector((state) => state.cart.items);
  const totalCount = useAppSelector((state) => state.cart.totalCount);
  const cartRestaurantId = useAppSelector((state) => state.cart.restaurantId);

  const isFavorite = useAppSelector(
    (state) => !!state.favorites.statusMap[String(restaurantId)],
  );
  const [activeCategory, setActiveCategory] = useState("Recommended");

  useEffect(() => {
    dispatch(fetchRestaurantById(restaurantId));
    dispatch(checkFavoriteStatus(restaurantId));
  }, [dispatch, restaurantId]);

  useEffect(() => {
    if (restaurant && restaurant.menu && restaurant.menu.length > 0) {
      setActiveCategory(restaurant.menu[0].category || "Recommended");
    }
  }, [restaurant]);

  const handleToggleFavorite = useCallback(() => {
    if (isFavorite) {
      dispatch(removeFavorite(restaurantId));
    } else {
      dispatch(addFavorite(restaurantId));
    }
  }, [dispatch, isFavorite, restaurantId]);

  useEffect(() => {
    if (
      restaurant &&
      restaurant.menu &&
      restaurant.menu.length > 0 &&
      !restaurant.menu.some((m) => m.category === activeCategory)
    ) {
      setActiveCategory(restaurant.menu[0]?.category ?? "Recommended");
    }
  }, [restaurant, activeCategory]);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({
    inputRange: [BANNER_HEIGHT - 80, BANNER_HEIGHT],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const bannerScale = scrollY.interpolate({
    inputRange: [-80, 0],
    outputRange: [1.3, 1],
    extrapolate: "clamp",
  });

  const getItemQty = useCallback(
    (itemId: string) => {
      const targetId = String(itemId);
      return (
        cartItems.find(
          (i) => String(i.id) === targetId || String(i.menuItemId) === targetId,
        )?.quantity ?? 0
      );
    },
    [cartItems],
  );

  const handleAdd = (item: MenuItem) => {
    const targetRestId = String(restaurant?.id ?? restaurantId);
    // 1. Single-restaurant rule check
    if (
      cartRestaurantId &&
      cartItems.length > 0 &&
      String(cartRestaurantId) !== targetRestId
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
              dispatch(
                addToCart({
                  id: String(item.id),
                  name: item.name,
                  price: item.price,
                  image: item.image,
                  restaurantId: targetRestId,
                }),
              );
              const menuItemId = parseInt(item.id, 10);
              if (!isNaN(menuItemId)) {
                dispatch(addCartItemServer({ menuItemId, quantity: 1 }));
              }
            },
          },
        ],
      );
      return;
    }

    // 2. Optimistic local update
    dispatch(
      addToCart({
        id: String(item.id),
        name: item.name,
        price: item.price,
        image: item.image,
        restaurantId: targetRestId,
      }),
    );

    // 3. Persist to backend
    const menuItemId = parseInt(item.id, 10);
    if (!isNaN(menuItemId)) {
      dispatch(addCartItemServer({ menuItemId, quantity: 1 }));
    }
  };

  const handleDecrement = (itemId: string) => {
    const targetId = String(itemId);
    const item = cartItems.find(
      (i) => String(i.id) === targetId || String(i.menuItemId) === targetId,
    );
    if (!item) return;

    // 1. Optimistic local update immediately
    dispatch(decrementQuantity(targetId));

    // 2. Persist to backend (backend supports both cartItemId and menuItemId)
    const backendId = item.id || item.menuItemId || targetId;
    if (item.quantity <= 1) {
      dispatch(removeCartItemServer(backendId));
    } else {
      dispatch(
        updateCartItemQuantityServer({
          cartItemId: backendId,
          quantity: item.quantity - 1,
        }),
      );
    }
  };
  const categories = useMemo(
    () => [...new Set((restaurant?.menu || []).map((m) => m.category))],

    [restaurant?.menu],
  );

  const filteredMenu = useMemo(
    () =>
      (restaurant?.menu || []).filter(
        (item) => item.category === activeCategory,
      ),

    [restaurant?.menu, activeCategory],
  );
  if (loading && !restaurant) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
          Loading restaurant details...
        </Text>
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <Ionicons name="alert-circle-outline" size={48} color="#C1121F" />
        <Text style={[styles.errorTitle, { color: theme.text }]}>
          Failed to load restaurant details
        </Text>
        <Text style={[styles.errorSubtitle, { color: theme.secondaryText }]}>
          {error || "Please check your connection and try again."}
        </Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: theme.primary }]}
          onPress={() => dispatch(fetchRestaurantById(restaurantId))}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // const categories = useMemo(
  //   () => [...new Set((restaurant.menu || []).map((m) => m.category))],
  //   [restaurant.menu],
  // );

  // const filteredMenu = useMemo(
  //   () =>
  //     (restaurant.menu || []).filter(
  //       (item) => item.category === activeCategory,
  //     ),
  //   [restaurant.menu, activeCategory],
  // );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* Sticky Header */}
      <RestaurantStickyHeader
        name={restaurant.name}
        isFavorite={isFavorite}
        onBack={() => navigation.goBack()}
        onToggleFavorite={handleToggleFavorite}
        headerOpacity={headerOpacity}
      />

      {/* Scrollable Content with Parallax Banner */}
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: totalCount > 0 ? 110 : 40,
        }}
      >
        {/* Parallax Hero Banner */}
        <RestaurantHeroBanner
          image={restaurant.image}
          bannerHeight={BANNER_HEIGHT}
          bannerScale={bannerScale}
          isFavorite={isFavorite}
          onBack={() => navigation.goBack()}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* Info Card */}
        <RestaurantInfoCard restaurant={restaurant} />

        {/* Category Tabs */}
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: theme.text }]}>
            {activeCategory} for you
          </Text>

          {filteredMenu.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              quantity={getItemQty(item.id)}
              onAdd={handleAdd}
              onDecrement={handleDecrement}
              restaurantId={restaurantId}
              restaurantName={restaurant.name}
            />
          ))}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  menuSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  menuSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
