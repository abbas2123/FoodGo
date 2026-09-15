import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { addToCart } from "@/store/slices/cartSlice";
import { resetFilters } from "@/store/slices/uiSlice";
import { PopularDishCard } from "@/features/home/components/PopularDishCard";
import { DishItem } from "@/features/home/types";
import { useTheme } from "@/theme/useTheme";

import { fetchPopularDishes } from "@/store/slices/restaurantsSlice";

export const DEFAULT_POPULAR_DISHES: DishItem[] = [
  {
    id: 1,
    name: "Pepperoni Pizza",
    category: "Pizza",
    rating: "4.9",
    reviews: "120",
    price: "12.99",
    image: "https://images.unsplash.com/photo-1628840042765-356cda07504e",
  },
  {
    id: 2,
    name: "Classic Cheeseburger",
    category: "Burgers",
    rating: "4.7",
    reviews: "85",
    price: "9.50",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
  },
  {
    id: 3,
    name: "Tropical Smoothie",
    category: "Drinks",
    rating: "4.8",
    reviews: "60",
    price: "4.99",
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

  React.useEffect(() => {
    if (storeDishes.length === 0) {
      dispatch(fetchPopularDishes());
    }
  }, [dispatch, storeDishes.length]);

  const dishes =
    propDishes || (storeDishes.length > 0 ? storeDishes : DEFAULT_POPULAR_DISHES);

  const handleAddToCart = (dish: DishItem) => {
    dispatch(
      addToCart({
        id: dish.id.toString(),
        name: dish.name,
        price: parseFloat(dish.price),
        image: dish.image,
        restaurantId: (dish as any).restaurantId || "1",
      }),
    );
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
            onPress={onDishPress}
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
