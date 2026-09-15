import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RestaurantData } from "../types";

interface RestaurantInfoCardProps {
  restaurant: RestaurantData;
}

export const RestaurantInfoCard: React.FC<RestaurantInfoCardProps> = ({
  restaurant,
}) => {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.restaurantName}>{restaurant.name}</Text>
      <Text style={styles.cuisineText}>{restaurant.cuisine}</Text>

      <View style={styles.metaRow}>
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={14} color="#FF6B35" />
          <Text style={styles.ratingText}>{restaurant.rating}</Text>
          <Text style={styles.reviewCount}>
            ({restaurant.reviewCount} reviews)
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <Ionicons name="time-outline" size={14} color="#6B7280" />
        <Text style={styles.metaText}>{restaurant.deliveryTime}</Text>
        <View style={styles.metaDivider} />
        <Ionicons name="bicycle-outline" size={14} color="#6B7280" />
        <Text style={styles.metaText}>{restaurant.deliveryFee} Delivery</Text>
      </View>

      <View style={styles.openBadge}>
        <View style={styles.openDot} />
        <Text style={styles.openText}>Open now</Text>
      </View>

      {restaurant.offer && (
        <View style={styles.offerBanner}>
          <Ionicons name="pricetag" size={16} color="#C1121F" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.offerText}>{restaurant.offer}</Text>
            <Text style={styles.offerSub}>Terms & conditions apply</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  infoCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 4,
  },
  cuisineText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  reviewCount: {
    fontSize: 13,
    color: "#6B7280",
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
  metaText: {
    fontSize: 13,
    color: "#6B7280",
  },
  openBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },
  openText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16A34A",
  },
  offerBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FED7D7",
    padding: 12,
  },
  offerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#C1121F",
    marginBottom: 2,
  },
  offerSub: {
    fontSize: 11,
    color: "#9CA3AF",
  },
});

export default RestaurantInfoCard;
