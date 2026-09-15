import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { addToCart, decrementQuantity } from "@/store/slices/cartSlice";
import { fetchRestaurantById } from "@/store/slices/restaurantsSlice";
import {
  addFavorite,
  removeFavorite,
  checkFavoriteStatus,
} from "@/store/slices/favoritesSlice";
import { AppStackParamList } from "@/navigation/types";
import { MenuItem } from "../types";
import { RESTAURANT_DATA } from "../data/mockRestaurants";
import {
  RestaurantStickyHeader,
  RestaurantHeroBanner,
  RestaurantInfoCard,
  CategoryTabs,
  MenuItemCard,
} from "../components";

type RestaurantDetailRouteProp = RouteProp<AppStackParamList, "RestaurantDetails">;
type RestaurantDetailNavProp = NativeStackNavigationProp<AppStackParamList>;

const BANNER_HEIGHT = 240;

export default function RestaurantDetailScreen() {
  const navigation = useNavigation<RestaurantDetailNavProp>();
  const route = useRoute<RestaurantDetailRouteProp>();
  const dispatch = useAppDispatch();

  const restaurantId = route.params?.id ?? "1";
  const storeRestaurant = useAppSelector((state) => state.restaurants.currentRestaurant);
  const restaurant =
    storeRestaurant && String(storeRestaurant.id) === String(restaurantId)
      ? storeRestaurant
      : RESTAURANT_DATA[restaurantId] ?? RESTAURANT_DATA["1"];

  const cartItems = useAppSelector((state) => state.cart.items);
  const totalCount = useAppSelector((state) => state.cart.totalCount);

  const isFavorite = useAppSelector(
    (state) => !!state.favorites.statusMap[String(restaurantId)],
  );
  const [activeCategory, setActiveCategory] = useState(
    restaurant.menu[0]?.category ?? "Recommended"
  );

  useEffect(() => {
    dispatch(fetchRestaurantById(restaurantId));
    dispatch(checkFavoriteStatus(restaurantId));
  }, [dispatch, restaurantId]);

  const handleToggleFavorite = useCallback(() => {
    if (isFavorite) {
      dispatch(removeFavorite(restaurantId));
    } else {
      dispatch(addFavorite(restaurantId));
    }
  }, [dispatch, isFavorite, restaurantId]);

  useEffect(() => {
    if (restaurant.menu.length > 0 && !restaurant.menu.some((m) => m.category === activeCategory)) {
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
    (itemId: string) =>
      cartItems.find((i) => i.id === itemId)?.quantity ?? 0,
    [cartItems]
  );

  const handleAdd = (item: MenuItem) => {
    dispatch(
      addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        restaurantId: restaurant.id,
      })
    );
  };

  const handleDecrement = (itemId: string) => {
    dispatch(decrementQuantity(itemId));
  };

  const categories = useMemo(
    () => [...new Set(restaurant.menu.map((m) => m.category))],
    [restaurant.menu]
  );

  const filteredMenu = useMemo(
    () => restaurant.menu.filter((item) => item.category === activeCategory),
    [restaurant.menu, activeCategory]
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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
          { useNativeDriver: true }
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
          <Text style={styles.menuSectionTitle}>{activeCategory} for you</Text>

          {filteredMenu.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              quantity={getItemQty(item.id)}
              onAdd={handleAdd}
              onDecrement={handleDecrement}
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
});
