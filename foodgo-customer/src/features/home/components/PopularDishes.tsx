import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Alert,
} from "react-native";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  addToCart,
  addCartItemServer,
  clearCart,
  clearCartServer,
} from "@/store/slices/cartSlice";
import { resetFilters } from "@/store/slices/uiSlice";
import { PopularDishCard } from "@/features/home/components/PopularDishCard";
import { DishItem } from "@/features/home/types";
import { useTheme } from "@/theme/useTheme";
import { fetchPopularDishes } from "@/store/slices/restaurantsSlice";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppStackParamList } from "@/navigation/types";

export const DEFAULT_POPULAR_DISHES: DishItem[] = [
  {
    id: 1,
    name: "Pepperoni Pizza",
    category: "Pizza",
    rating: "4.9",
    reviews: "120",
    price: "349",
    image: "https://images.unsplash.com/photo-1628840042765-356cda07504e",
  },
  {
    id: 2,
    name: "Classic Cheeseburger",
    category: "Burgers",
    rating: "4.7",
    reviews: "85",
    price: "249",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
  },
  {
    id: 3,
    name: "Tropical Smoothie",
    category: "Drinks",
    rating: "4.8",
    reviews: "60",
    price: "149",
    image: "https://images.unsplash.com/photo-1502741224143-90386d7f8c82",
  },
];

interface PopularDishesProps {
  dishes?: DishItem[];
  onDishPress?: (dish: DishItem) => void;
}

export const PopularDishes: React.FC<PopularDishesProps> = ({
  dishes: propDishes,
  onDishPress,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 500;
  const horizontalPadding = isSmallScreen ? 20 : 60;
  const { theme } = useTheme();

  const dispatch = useAppDispatch();
  const { selectedCategory, searchQuery } = useAppSelector(
    (state) => state.ui,
  );
  const storeDishes = useAppSelector(
    (state) => state.restaurants.popularDishes,
  );
  const cartRestaurantId = useAppSelector((state) => state.cart.restaurantId);
  const cartItems = useAppSelector((state) => state.cart.items);

  React.useEffect(() => {
    if (storeDishes.length === 0) {
      dispatch(fetchPopularDishes());
    }
  }, [dispatch, storeDishes.length]);

  const dishes =
    propDishes || (storeDishes.length > 0 ? storeDishes : DEFAULT_POPULAR_DISHES);

  /**
   * Performs the actual cart mutation once any conflict has been resolved.
   *
   * Dishes without a real backend restaurantId (e.g. DEFAULT_POPULAR_DISHES)
   * are NOT added directly — we navigate to ProductDetails so the user picks
   * the actual restaurant context. Silently adding with a fake ID would cause
   * the backend to fail or add to the wrong restaurant's cart.
   */
  const executeAddToCart = (dish: DishItem) => {
    const targetRestaurantId = (dish as any).restaurantId
      ? String((dish as any).restaurantId)
      : null;

    if (!targetRestaurantId) {
      navigation.navigate("ProductDetails", {
        dish,
        restaurantId: (dish as any).restaurantId,
        restaurantName: (dish as any).restaurantName,
      });
      return;
    }

    // 1. Optimistic local update — cart badge and CartModal update instantly
    dispatch(
      addToCart({
        id: dish.id.toString(),
        name: dish.name,
        price: parseFloat(dish.price),
        image: dish.image,
        restaurantId: targetRestaurantId,
      }),
    );

    // 2. Persist to backend (only with a real numeric menuItemId)
    const menuItemId = Number(dish.id);
    if (!isNaN(menuItemId) && menuItemId > 0) {
      dispatch(addCartItemServer({ menuItemId, quantity: 1 }));
    }
  };

  /**
   * Entry point for the "+" button on a popular dish card.
   * Applies the same single-restaurant-per-cart rule as RestaurantDetailScreen.
   * Under no circumstance should an item silently disappear.
   */
  const handleAddToCart = (dish: DishItem) => {
    const targetRestaurantId = (dish as any).restaurantId
      ? String((dish as any).restaurantId)
      : null;

    // Restaurant-conflict check — same guard as RestaurantDetailScreen.handleAdd
    if (
      targetRestaurantId &&
      cartRestaurantId &&
      cartItems.length > 0 &&
      String(cartRestaurantId) !== targetRestaurantId
    ) {
      Alert.alert(
        "Replace cart items?",
        "Your cart contains dishes from another restaurant. Do you want to clear your cart and start a fresh order?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear & Add",
            style: "destructive",
            onPress: async () => {
              await dispatch(clearCartServer()).unwrap();
              dispatch(clearCart());
              executeAddToCart(dish);
            },
          },
        ],
      );
      return;
    }

    executeAddToCart(dish);
  };

  const filteredDishes = dishes.filter((dish) => {
    const matchesCategory =
      selectedCategory === "All" ||
      dish.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      searchQuery.trim() === "" ||
      dish.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <View>
      <View
        style={[
          styles.categoriesHeader,
          {
            marginHorizontal: horizontalPadding,
            marginTop: isSmallScreen ? 35 : 55,
          },
        ]}
      >
        <Text
          style={[
            styles.categoriesTitle,
            {
              color: theme.text,
              fontSize: isSmallScreen ? 25 : 42,
            },
          ]}
        >
          Popular Dishes
        </Text>

        <Pressable onPress={() => dispatch(resetFilters())}>
          <Text
            style={[
              styles.seeAll,
              {
                fontSize: isSmallScreen ? 16 : 25,
              },
            ]}
          >
            See All
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.popularDishesScroll,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: isSmallScreen ? 16 : 24,
          },
        ]}
      >
        {filteredDishes.map((dish) => (
          <PopularDishCard
            key={dish.id}
            dish={dish}
            onAddToCart={handleAddToCart}
            onPress={
              onDishPress ||
              ((item) =>
                navigation.navigate("ProductDetails", {
                  dish: item,
                  restaurantId: (item as any).restaurantId || "1",
                  restaurantName: (item as any).restaurantName,
                }))
            }
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  categoriesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoriesTitle: {
    fontWeight: "700",
  },
  seeAll: {
    fontWeight: "600",
    color: "#C1121F",
  },
  popularDishesScroll: {
    gap: 16,
  },
});
