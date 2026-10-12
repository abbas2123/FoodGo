import React from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/useTheme";

interface RestaurantStickyHeaderProps {
  name: string;
  isFavorite: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  headerOpacity: Animated.AnimatedInterpolation<number>;
}

export const RestaurantStickyHeader: React.FC<RestaurantStickyHeaderProps> = ({
  name,
  isFavorite,
  onBack,
  onToggleFavorite,
  headerOpacity,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <Animated.View
      style={[
        styles.stickyHeader,
        {
          opacity: headerOpacity,
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          borderBottomWidth: isDark ? 1 : 0,
        },
      ]}
    >
      <SafeAreaView edges={["top"]}>
        <View style={styles.stickyHeaderInner}>
          <Pressable
            style={[
              styles.iconBtn,
              { backgroundColor: isDark ? theme.card : "#F3F4F6" },
            ]}
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.stickyTitle, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Pressable
            style={[
              styles.iconBtn,
              { backgroundColor: isDark ? theme.card : "#F3F4F6" },
            ]}
            onPress={onToggleFavorite}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={22}
              color={isFavorite ? "#C1121F" : theme.text}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },
  stickyHeaderInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  stickyTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default RestaurantStickyHeader;
