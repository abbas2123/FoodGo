import React, { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { fetchRestaurants } from "@/store/slices/restaurantsSlice";

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: string;
  image: string;
  distance: string;
}

const NEARBY_RESTAURANTS: Restaurant[] = [
  {
    id: "1",
    name: "The Burger House",
    cuisine: "American • Burgers",
    rating: 4.8,
    deliveryTime: "15-25 min",
    deliveryFee: "Free",
    image:
      "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&q=80",
    distance: "0.5 km",
  },
  {
    id: "2",
    name: "Spice Garden",
    cuisine: "Indian • Curry",
    rating: 4.6,
    deliveryTime: "20-30 min",
    deliveryFee: "$1.99",
    image:
      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&q=80",
    distance: "0.9 km",
  },
  {
    id: "3",
    name: "Sakura Sushi",
    cuisine: "Japanese • Sushi",
    rating: 4.9,
    deliveryTime: "25-35 min",
    deliveryFee: "Free",
    image:
      "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=300&q=80",
    distance: "1.2 km",
  },
  {
    id: "4",
    name: "Pizza Perfecto",
    cuisine: "Italian • Pizza",
    rating: 4.7,
    deliveryTime: "20-30 min",
    deliveryFee: "$0.99",
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&q=80",
    distance: "1.5 km",
  },
];

function RestaurantCard({ item }: { item: Restaurant }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      activeOpacity={0.85}
      onPress={() => navigation.navigate("RestaurantDetails", { id: item.id })}
    >
      <Image source={{ uri: item.image }} style={styles.cardImage} />
      <View
        style={[
          styles.feeBadge,
          { backgroundColor: item.deliveryFee === "Free" ? "#FF6B35" : theme.card },
        ]}
      >
        <Text
          style={[
            styles.feeText,
            { color: item.deliveryFee === "Free" ? "#fff" : "#FF6B35" },
          ]}
        >
          {item.deliveryFee === "Free" ? "Free delivery" : item.deliveryFee}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={[styles.restaurantName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.ratingPill, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="star" size={11} color="#FF6B35" />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        </View>

        <Text style={[styles.cuisine, { color: theme.muted }]}>{item.cuisine}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={12} color={theme.muted} />
          <Text style={[styles.metaText, { color: theme.muted }]}>
            {item.deliveryTime}
          </Text>
          <View style={[styles.dot, { backgroundColor: theme.border }]} />
          <Ionicons name="location-outline" size={12} color={theme.muted} />
          <Text style={[styles.metaText, { color: theme.muted }]}>
            {item.distance}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function NearByRestorent() {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const storeRestaurants = useAppSelector(
    (state) => state.restaurants.restaurants,
  );
  const selectedCategory = useAppSelector(
    (state) => state.ui.selectedCategory,
  );

  useEffect(() => {
    dispatch(fetchRestaurants(selectedCategory));
  }, [dispatch, selectedCategory]);

  const displayData =
    storeRestaurants.length > 0 ? storeRestaurants : NEARBY_RESTAURANTS;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Nearby Restaurants
        </Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RestaurantCard item={item} />}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF6B35",
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImage: {
    width: "100%",
    height: 150,
    resizeMode: "cover",
  },
  feeBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  feeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardBody: {
    padding: 12,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FF6B35",
  },
  cuisine: {
    fontSize: 12,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: "500",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  separator: {
    height: 12,
  },
});
