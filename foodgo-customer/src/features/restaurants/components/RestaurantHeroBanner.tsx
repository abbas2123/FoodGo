import React from "react";
import { View, StyleSheet, Pressable, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface RestaurantHeroBannerProps {
  image: string;
  bannerHeight: number;
  bannerScale: Animated.AnimatedInterpolation<number>;
  isFavorite: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
}

export const RestaurantHeroBanner: React.FC<RestaurantHeroBannerProps> = ({
  image,
  bannerHeight,
  bannerScale,
  isFavorite,
  onBack,
  onToggleFavorite,
}) => {
  return (
    <View style={{ height: bannerHeight, overflow: "hidden" }}>
      <Animated.Image
        source={{ uri: image }}
        style={[
          styles.bannerImage,
          { height: bannerHeight, transform: [{ scale: bannerScale }] },
        ]}
      />
      <View style={styles.bannerOverlay} />
      <SafeAreaView edges={["top"]} style={styles.bannerControls}>
        <Pressable style={styles.floatingBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color="#1F2937" />
        </Pressable>
        <Pressable style={styles.floatingBtn} onPress={onToggleFavorite}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={20}
            color={isFavorite ? "#C1121F" : "#1F2937"}
          />
        </Pressable>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerImage: {
    width: "100%",
    resizeMode: "cover",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  bannerControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  floatingBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default RestaurantHeroBanner;
