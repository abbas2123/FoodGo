import React, { useEffect } from "react";
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
import { setSelectedCategory } from "@/store/slices/uiSlice";
import { fetchCategories } from "@/store/slices/restaurantsSlice";
import { CategoryItem } from "@/features/home/types";
import { useTheme } from "@/theme/useTheme";

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "pizza", name: "Pizza", emoji: "🍕" },
  { id: "burgers", name: "Burgers", emoji: "🍔" },
  { id: "asian", name: "Asian", emoji: "🍜" },
  { id: "desserts", name: "Desserts", emoji: "🍰" },
  { id: "drinks", name: "Drinks", emoji: "🥤" },
];

interface CategoryListProps {
  categories?: CategoryItem[];
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories: propCategories,
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 500;
  const horizontalPadding = isSmallScreen ? 20 : 60;
  const { theme } = useTheme();

  const dispatch = useAppDispatch();
  const selectedCategory = useAppSelector((state) => state.ui.selectedCategory);
  const storeCategories = useAppSelector((state) => state.restaurants.categories);

  useEffect(() => {
    if (storeCategories.length === 0) {
      dispatch(fetchCategories());
    }
  }, [dispatch, storeCategories.length]);

  const categories =
    propCategories ||
    (storeCategories.length > 0 ? storeCategories : DEFAULT_CATEGORIES);

  const handleCategoryPress = (categoryName: string) => {
    if (selectedCategory.toLowerCase() === categoryName.toLowerCase()) {
      dispatch(setSelectedCategory("All"));
    } else {
      dispatch(setSelectedCategory(categoryName));
    }
  };

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
            { color: theme.text, fontSize: isSmallScreen ? 25 : 42 },
          ]}
        >
          Categories
        </Text>

        <Pressable onPress={() => dispatch(setSelectedCategory("All"))}>
          <Text
            style={[
              styles.seeAll,
              { fontSize: isSmallScreen ? 16 : 25 },
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
          styles.categoriesContainer,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: isSmallScreen ? 20 : 30,
          },
        ]}
      >
        {categories.map((category) => {
          const isActive =
            selectedCategory.toLowerCase() === category.name.toLowerCase();

          return (
            <Pressable
              key={category.id}
              style={styles.categoryItem}
              onPress={() => handleCategoryPress(category.name)}
            >
              <View
                style={[
                  styles.categoryImageContainer,
                  {
                    backgroundColor: isActive
                      ? theme.categoryChipActive
                      : theme.categoryChip,
                    width: isSmallScreen ? 70 : 110,
                    height: isSmallScreen ? 70 : 110,
                    borderRadius: isSmallScreen ? 35 : 55,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryEmoji,
                    { fontSize: isSmallScreen ? 32 : 50 },
                  ]}
                >
                  {category.emoji}
                </Text>
              </View>

              <Text
                style={[
                  styles.categoryText,
                  {
                    color: isActive ? theme.primary : theme.text,
                    fontWeight: isActive ? "700" : "600",
                    fontSize: isSmallScreen ? 14 : 18,
                  },
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
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
  categoriesContainer: {
    gap: 20,
  },
  categoryItem: {
    width: 85,
    alignItems: "center",
  },
  categoryImageContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  categoryEmoji: {},
  categoryText: {
    marginTop: 8,
  },
});
