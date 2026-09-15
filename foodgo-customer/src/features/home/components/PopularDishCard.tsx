import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DishItem } from "@/features/home/types";
import { useTheme } from "@/theme/useTheme";

interface PopularDishCardProps {
  dish: DishItem;
  onAddToCart: (dish: DishItem) => void;
  onPress?: (dish: DishItem) => void;
}

export const PopularDishCard: React.FC<PopularDishCardProps> = ({
  dish,
  onAddToCart,
  onPress,
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 500;
  const { theme } = useTheme();

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          width: isSmallScreen ? 180 : 250,
          height: isSmallScreen ? 260 : 350,
          padding: isSmallScreen ? 12 : 16,
          borderRadius: isSmallScreen ? 20 : 26,
        },
      ]}
      onPress={() => onPress?.(dish)}
    >
      <Image
        source={{ uri: dish.image }}
        style={[
          styles.image,
          {
            height: isSmallScreen ? 115 : 160,
            borderRadius: isSmallScreen ? 14 : 18,
          },
        ]}
      />

      <Text
        style={[
          styles.name,
          {
            color: theme.text,
            fontSize: isSmallScreen ? 16 : 22,
            marginTop: isSmallScreen ? 10 : 14,
          },
        ]}
        numberOfLines={1}
      >
        {dish.name}
      </Text>

      <View style={styles.ratingRow}>
        <Ionicons
          name="star"
          size={isSmallScreen ? 15 : 19}
          color="#008F78"
        />
        <Text
          style={[
            styles.ratingText,
            {
              color: theme.secondaryText,
              fontSize: isSmallScreen ? 13 : 16,
            },
          ]}
        >
          {dish.rating} ({dish.reviews}+)
        </Text>
      </View>

      <View style={styles.priceRow}>
        <Text
          style={[
            styles.price,
            { fontSize: isSmallScreen ? 18 : 24 },
          ]}
        >
          ${dish.price}
        </Text>

        <Pressable
          style={[
            styles.addButton,
            {
              width: isSmallScreen ? 36 : 46,
              height: isSmallScreen ? 36 : 46,
              borderRadius: isSmallScreen ? 18 : 23,
            },
          ]}
          onPress={() => onAddToCart(dish)}
        >
          <Text
            style={[
              styles.addButtonText,
              {
                fontSize: isSmallScreen ? 22 : 28,
                lineHeight: isSmallScreen ? 24 : 30,
              },
            ]}
          >
            +
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  image: {
    width: "100%",
    resizeMode: "cover",
  },
  name: {
    fontWeight: "700",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  ratingText: {
    marginLeft: 6,
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
  },
  price: {
    fontWeight: "700",
    color: "#C51F2A",
  },
  addButton: {
    backgroundColor: "#C51F2A",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "300",
  },
});
