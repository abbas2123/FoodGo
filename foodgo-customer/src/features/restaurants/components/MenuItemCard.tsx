import React from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/useTheme";
import { MenuItem } from "../types";
import { VegIcon } from "./VegIcon";
import { formatINR } from "@/utils/currency";

import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppStackParamList } from "@/navigation/types";

interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  onAdd: (item: MenuItem) => void;
  onDecrement: (itemId: string) => void;
  restaurantId?: string;
  restaurantName?: string;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  quantity,
  onAdd,
  onDecrement,
  restaurantId,
  restaurantName,
}) => {
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const handleOpenDetail = () => {
    navigation.navigate("ProductDetails", {
      dish: item,
      restaurantId,
      restaurantName,
    });
  };

  return (
    <View
      style={[
        styles.menuItem,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: isDark ? 1 : 0,
        },
      ]}
    >
      {/* Left Details */}
      <Pressable style={styles.menuItemLeft} onPress={handleOpenDetail}>
        <View style={styles.vegRow}>
          <VegIcon isVeg={item.isVeg} />
          {item.isBestseller && (
            <View
              style={[
                styles.bestsellerBadge,
                {
                  backgroundColor: isDark ? "#3D2B14" : "#FFF7ED",
                  borderColor: isDark ? "#6B4A1D" : "#FED7AA",
                },
              ]}
            >
              <Text
                style={[
                  styles.bestsellerText,
                  { color: isDark ? "#FBBF24" : "#D97706" },
                ]}
              >
                ⭐ Bestseller
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.menuItemName, { color: theme.text }]}>
          {item.name}
        </Text>
        <Text
          style={[styles.menuItemDesc, { color: theme.secondaryText }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.menuItemPrice, { color: theme.text }]}>
            {formatINR(item.price)}
          </Text>
          <View style={styles.miniRating}>
            <Ionicons name="star" size={11} color="#FF6B35" />
            <Text style={styles.miniRatingText}>{item.rating}</Text>
          </View>
        </View>
      </Pressable>

      {/* Right Image & Add/Quantity button */}
      <View style={styles.menuItemRight}>
        <Pressable onPress={handleOpenDetail}>
          <Image source={{ uri: item.image }} style={styles.menuItemImage} />
        </Pressable>
        {quantity === 0 ? (
          <Pressable
            style={[
              styles.addBtn,
              {
                backgroundColor: isDark ? theme.primaryLight : "#FFF5F5",
                borderColor: theme.primary,
              },
            ]}
            onPress={() => onAdd(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="add" size={22} color={theme.primary} />
          </Pressable>
        ) : (
          <View
            style={[
              styles.qtyControl,
              { backgroundColor: theme.primary },
            ]}
          >
            <Pressable
              style={styles.qtyBtn}
              onPress={() => onDecrement(item.id)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="remove" size={16} color="#fff" />
            </Pressable>
            <Text style={styles.qtyText}>{quantity}</Text>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => onAdd(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  menuItemLeft: {
    flex: 1,
  },
  vegRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  bestsellerBadge: {
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  bestsellerText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  menuItemDesc: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  miniRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  miniRatingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B35",
  },
  menuItemRight: {
    alignItems: "center",
    gap: 8,
  },
  menuItemImage: {
    width: 100,
    height: 90,
    borderRadius: 12,
    resizeMode: "cover",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF5F5",
    borderWidth: 1.5,
    borderColor: "#C1121F",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#C1121F",
    borderRadius: 20,
    overflow: "hidden",
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    minWidth: 20,
    textAlign: "center",
  },
});

export default MenuItemCard;
