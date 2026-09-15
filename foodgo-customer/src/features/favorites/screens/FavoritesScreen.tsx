import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  fetchFavorites,
  removeFavorite,
} from "@/store/slices/favoritesSlice";
import { FavoriteItem } from "@/api/favorites/favoritesApi";

export default function FavoritesScreen() {
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();

  const { items, loading } = useAppSelector((state) => state.favorites);

  useEffect(() => {
    dispatch(fetchFavorites());
  }, [dispatch]);

  const onRefresh = useCallback(() => {
    dispatch(fetchFavorites());
  }, [dispatch]);

  const handleRemoveFavorite = useCallback(
    (restaurantId: string) => {
      dispatch(removeFavorite(restaurantId));
    },
    [dispatch],
  );

  const renderItem = ({ item }: { item: FavoriteItem }) => {
    const r = item.restaurant;
    if (!r) return null;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: isDark ? "#2A2A2A" : "#F0F0F0",
          },
        ]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("RestaurantDetails", { id: r.id })}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                r.image ||
                "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80",
            }}
            style={styles.cardImage}
          />
          <TouchableOpacity
            style={styles.heartButton}
            activeOpacity={0.7}
            onPress={() => handleRemoveFavorite(r.id)}
          >
            <Ionicons name="heart" size={20} color="#FF4B4B" />
          </TouchableOpacity>
          {r.offer ? (
            <View style={styles.offerBadge}>
              <Text style={styles.offerText}>{r.offer}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text
              style={[styles.restaurantName, { color: theme.text }]}
              numberOfLines={1}
            >
              {r.name}
            </Text>
            <View
              style={[
                styles.ratingPill,
                { backgroundColor: isDark ? "#2C1E14" : "#FFF4ED" },
              ]}
            >
              <Ionicons name="star" size={12} color="#FF6B35" />
              <Text style={styles.ratingText}>{r.rating}</Text>
            </View>
          </View>

          <Text style={[styles.cuisine, { color: theme.muted }]} numberOfLines={1}>
            {r.cuisine}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={theme.muted} />
              <Text style={[styles.metaText, { color: theme.muted }]}>
                {r.deliveryTime}
              </Text>
            </View>
            <View style={[styles.dot, { backgroundColor: theme.border }]} />
            <View style={styles.metaItem}>
              <Ionicons name="bicycle-outline" size={13} color={theme.muted} />
              <Text
                style={[
                  styles.metaText,
                  {
                    color:
                      r.deliveryFee === "Free" ? "#10B981" : theme.muted,
                    fontWeight: r.deliveryFee === "Free" ? "600" : "400",
                  },
                ]}
              >
                {r.deliveryFee}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: isDark ? "#222" : "#F0F0F0",
            backgroundColor: theme.background,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.text }]}>Favorites</Text>
        {items.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: "#FF6B35" }]}>
            <Text style={styles.countText}>{items.length}</Text>
          </View>
        )}
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: isDark ? "#2A1E1E" : "#FFF0F0" },
            ]}
          >
            <Ionicons name="heart-outline" size={56} color="#FF6B35" />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No favorites yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
            Save your favorite restaurants to find them quickly whenever hunger strikes!
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Home")}
          >
            <Text style={styles.exploreButtonText}>Explore Restaurants</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
              colors={["#FF6B35"]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  exploreButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 160,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heartButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  offerBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  offerText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  cardBody: {
    padding: 14,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FF6B35",
  },
  cuisine: {
    fontSize: 13,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  metaText: {
    fontSize: 12,
  },
});
