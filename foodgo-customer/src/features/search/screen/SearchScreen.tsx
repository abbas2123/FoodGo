import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  searchRestaurants,
  clearSearch,
} from "@/store/slices/restaurantsSlice";
import { addToCart } from "@/store/slices/cartSlice";
import { RestaurantListItem, SearchDishItem } from "@/api/restaurants/restaurantsApi";

const initialRecentSearches = ["Burger", "Biryani", "Pizza", "Momos"];

const popularSearches = [
  "Burgers",
  "Pizza",
  "Biryani",
  "Chinese",
  "Desserts",
  "South Indian",
  "Healthy",
];

const categories = [
  { name: "Pizza", icon: "pizza-outline" as const },
  { name: "Burgers", icon: "fast-food-outline" as const },
  { name: "Biryani", icon: "restaurant-outline" as const },
  { name: "Chinese", icon: "restaurant-outline" as const },
  { name: "Desserts", icon: "ice-cream-outline" as const },
  { name: "Drinks", icon: "wine-outline" as const },
  { name: "Indian", icon: "restaurant-outline" as const },
  { name: "Healthy", icon: "leaf-outline" as const },
];

export default function SearchPage() {
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();

  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState(initialRecentSearches);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchResults = useAppSelector((state) => state.restaurants.searchResults);
  const searchLoading = useAppSelector((state) => state.restaurants.searchLoading);

  // Debounced search
  useEffect(() => {
    const trimmed = search.trim();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (trimmed.length > 0) {
      debounceTimerRef.current = setTimeout(() => {
        dispatch(searchRestaurants(trimmed));
      }, 300);
    } else {
      dispatch(clearSearch());
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search, dispatch]);

  const handleSelectQuery = (term: string) => {
    setSearch(term);
    if (!recent.includes(term)) {
      setRecent((prev) => [term, ...prev.slice(0, 5)]);
    }
  };

  const removeRecentSearch = (item: string) => {
    setRecent((prev) => prev.filter((s) => s !== item));
  };

  const clearAllRecent = () => {
    setRecent([]);
  };

  const handleDishPress = (dish: SearchDishItem) => {
    navigation.navigate("RestaurantDetails", { id: dish.restaurantId });
  };

  const handleAddDishToCart = (dish: SearchDishItem) => {
    dispatch(
      addToCart({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        image: dish.image,
        restaurantId: dish.restaurantId,
      }),
    );
  };

  const isSearching = search.trim().length > 0;
  const restaurants = searchResults?.restaurants ?? [];
  const dishes = searchResults?.dishes ?? [];
  const hasResults = restaurants.length > 0 || dishes.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search Header */}
      <View style={[styles.searchHeader, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: theme.card,
              borderColor: isDark ? "#333" : "#EBEBEB",
            },
          ]}
        >
          <Ionicons name="search-outline" size={20} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search restaurants or dishes..."
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text }]}
            returnKeyType="search"
            autoFocus={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {isSearching ? (
          searchLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={[styles.loadingText, { color: theme.muted }]}>
                Searching for "{search}"...
              </Text>
            </View>
          ) : !hasResults ? (
            <View style={styles.emptyBox}>
              <Ionicons name="search-outline" size={54} color={theme.muted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No results found
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
                We couldn't find any restaurants or dishes matching "{search}".
              </Text>
            </View>
          ) : (
            <View>
              {/* Restaurants Section */}
              {restaurants.length > 0 && (
                <View style={styles.resultsSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Restaurants ({restaurants.length})
                  </Text>
                  <View style={styles.restaurantResultsList}>
                    {restaurants.map((r) => (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.restaurantRow,
                          {
                            backgroundColor: theme.card,
                            borderColor: isDark ? "#2C2C2C" : "#F0F0F0",
                          },
                        ]}
                        activeOpacity={0.8}
                        onPress={() =>
                          navigation.navigate("RestaurantDetails", { id: r.id })
                        }
                      >
                        <Image
                          source={{
                            uri:
                              r.image ||
                              "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&q=80",
                          }}
                          style={styles.restaurantThumb}
                        />
                        <View style={styles.restaurantInfo}>
                          <Text
                            style={[styles.restaurantName, { color: theme.text }]}
                            numberOfLines={1}
                          >
                            {r.name}
                          </Text>
                          <Text
                            style={[styles.restaurantCuisine, { color: theme.muted }]}
                            numberOfLines={1}
                          >
                            {r.cuisine}
                          </Text>
                          <View style={styles.restaurantMeta}>
                            <View style={styles.ratingBadge}>
                              <Ionicons name="star" size={11} color="#fff" />
                              <Text style={styles.ratingBadgeText}>{r.rating}</Text>
                            </View>
                            <Text style={[styles.metaDot, { color: theme.muted }]}>
                              •
                            </Text>
                            <Text style={[styles.metaSmall, { color: theme.muted }]}>
                              {r.deliveryTime}
                            </Text>
                            <Text style={[styles.metaDot, { color: theme.muted }]}>
                              •
                            </Text>
                            <Text style={[styles.metaSmall, { color: theme.muted }]}>
                              {r.deliveryFee}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={theme.muted}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Dishes Section */}
              {dishes.length > 0 && (
                <View style={styles.resultsSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Dishes ({dishes.length})
                  </Text>
                  <View style={styles.dishResultsList}>
                    {dishes.map((dish) => (
                      <TouchableOpacity
                        key={dish.id}
                        style={[
                          styles.dishRow,
                          {
                            backgroundColor: theme.card,
                            borderColor: isDark ? "#2C2C2C" : "#F0F0F0",
                          },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => handleDishPress(dish)}
                      >
                        <Image
                          source={{
                            uri:
                              dish.image ||
                              "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80",
                          }}
                          style={styles.dishThumb}
                        />
                        <View style={styles.dishInfo}>
                          <View style={styles.dishTitleRow}>
                            <View
                              style={[
                                styles.vegIndicator,
                                {
                                  borderColor: dish.isVeg ? "#10B981" : "#EF4444",
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.vegDot,
                                  {
                                    backgroundColor: dish.isVeg
                                      ? "#10B981"
                                      : "#EF4444",
                                  },
                                ]}
                              />
                            </View>
                            <Text
                              style={[styles.dishName, { color: theme.text }]}
                              numberOfLines={1}
                            >
                              {dish.name}
                            </Text>
                          </View>
                          <Text
                            style={[styles.dishRestaurant, { color: theme.muted }]}
                            numberOfLines={1}
                          >
                            By {dish.restaurantName}
                          </Text>
                          <Text style={styles.dishPrice}>₹{dish.price}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.addDishBtn}
                          activeOpacity={0.7}
                          onPress={() => handleAddDishToCart(dish)}
                        >
                          <Text style={styles.addDishBtnText}>ADD</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )
        ) : (
          /* Default state when search query is empty */
          <View>
            {/* Recent Searches */}
            {recent.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Recent searches
                  </Text>
                  <Pressable onPress={clearAllRecent}>
                    <Text style={styles.clearText}>Clear all</Text>
                  </Pressable>
                </View>

                <View style={styles.recentList}>
                  {recent.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={styles.recentItem}
                      activeOpacity={0.7}
                      onPress={() => handleSelectQuery(item)}
                    >
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color={theme.muted}
                      />
                      <Text
                        style={[styles.recentText, { color: theme.text }]}
                      >
                        {item}
                      </Text>
                      <Pressable
                        onPress={() => removeRecentSearch(item)}
                        hitSlop={10}
                      >
                        <Ionicons
                          name="close-outline"
                          size={20}
                          color={theme.muted}
                        />
                      </Pressable>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Popular Searches */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Popular searches
              </Text>
              <View style={styles.chipsContainer}>
                {popularSearches.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isDark ? "#2A1E1E" : "#FFF0F0",
                        borderColor: isDark ? "#4A2E2E" : "#FFE0DE",
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectQuery(item)}
                  >
                    <Ionicons name="trending-up" size={13} color="#FF6B35" />
                    <Text style={styles.chipText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Explore Categories */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Explore categories
              </Text>
              <View style={styles.categoryGrid}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.name}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: isDark ? "#2C2C2C" : "#F0F0F0",
                      },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handleSelectQuery(category.name)}
                  >
                    <View
                      style={[
                        styles.catIconCircle,
                        {
                          backgroundColor: isDark ? "#2C1E14" : "#FFF4ED",
                        },
                      ]}
                    >
                      <Ionicons
                        name={category.icon}
                        size={28}
                        color="#FF6B35"
                      />
                    </View>
                    <Text
                      style={[styles.categoryName, { color: theme.text }]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 10,
  },
  searchContainer: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 8,
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyBox: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  resultsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  restaurantResultsList: {
    gap: 10,
  },
  restaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  restaurantThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  restaurantInfo: {
    flex: 1,
    gap: 2,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: "700",
  },
  restaurantCuisine: {
    fontSize: 12,
  },
  restaurantMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  ratingBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  metaDot: {
    fontSize: 12,
  },
  metaSmall: {
    fontSize: 12,
  },
  dishResultsList: {
    gap: 10,
  },
  dishRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dishThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  dishInfo: {
    flex: 1,
    gap: 2,
  },
  dishTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vegIndicator: {
    width: 13,
    height: 13,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dishName: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  dishRestaurant: {
    fontSize: 12,
  },
  dishPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF6B35",
    marginTop: 2,
  },
  addDishBtn: {
    borderWidth: 1,
    borderColor: "#FF6B35",
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addDishBtnText: {
    color: "#FF6B35",
    fontSize: 12,
    fontWeight: "700",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  clearText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF6B35",
  },
  recentList: {
    gap: 10,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  recentText: {
    flex: 1,
    fontSize: 14,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 18,
  },
  chipText: {
    fontSize: 13,
    color: "#FF6B35",
    fontWeight: "500",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  categoryCard: {
    width: "48%",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  catIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
  },
});
