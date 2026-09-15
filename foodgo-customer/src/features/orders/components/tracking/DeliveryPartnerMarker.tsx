import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Platform } from "react-native";
import { Marker, MarkerAnimated, AnimatedRegion, MapMarker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { Coordinates } from "@/types/order.types";

interface DeliveryPartnerMarkerProps {
  coordinate: Coordinates;
  heading?: number;
  partnerName?: string;
}

export const DeliveryPartnerMarker: React.FC<DeliveryPartnerMarkerProps> =
  React.memo(({ coordinate, heading = 0, partnerName = "Delivery Partner" }) => {
    const markerRef = useRef<MapMarker | null>(null);

    // Animated coordinate for smooth marker motion
    const animatedCoord = useRef(
      new AnimatedRegion({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      })
    ).current;

    // Animated radar pulse ring
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const pulseOpacity = useRef(new Animated.Value(0.7)).current;

    useEffect(() => {
      const loop = Animated.loop(
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 2.2,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, [pulseAnim, pulseOpacity]);

    // Smoothly animate to new coordinates whenever coordinate changes
    useEffect(() => {
      if (markerRef.current?.animateMarkerToCoordinate) {
        markerRef.current.animateMarkerToCoordinate(coordinate, 1500);
      }

      // Also drive AnimatedRegion for AnimatedMarker compatibility
      if ((animatedCoord as any).timing) {
        (animatedCoord as any)
          .timing({
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            duration: 1500,
            useNativeDriver: false,
          })
          .start();
      }
    }, [coordinate.latitude, coordinate.longitude]);

    return (
      <MarkerAnimated
        ref={markerRef}
        coordinate={animatedCoord as any}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={Platform.OS === "android"}
      >
        <View style={styles.wrapper}>
          {/* Partner Name Chip */}
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {partnerName}
            </Text>
          </View>

          {/* Pulse Halo */}
          <Animated.View
            style={[
              styles.pulseCircle,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseOpacity,
              },
            ]}
          />

          {/* Rotating Scooter / Bike Icon */}
          <View
            style={[
              styles.markerCircle,
              {
                transform: [{ rotate: `${heading}deg` }],
              },
            ]}
          >
            <Ionicons name="bicycle" size={20} color="#FFFFFF" />
          </View>
        </View>
      </MarkerAnimated>
    );
  });

DeliveryPartnerMarker.displayName = "DeliveryPartnerMarker";

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 100,
    height: 100,
  },
  chip: {
    position: "absolute",
    top: 6,
    backgroundColor: "#1F1010",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 10,
  },
  chipText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  pulseCircle: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(193, 18, 31, 0.35)",
  },
  markerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#C1121F", // FoodiGo Primary Red
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
  },
});
