import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { Coordinates } from "@/types/order.types";

interface CustomerMarkerProps {
  coordinate: Coordinates;
  label?: string;
}

export const CustomerMarker: React.FC<CustomerMarkerProps> = React.memo(
  ({ coordinate, label = "Home" }) => {
    return (
      <Marker
        coordinate={coordinate}
        tracksViewChanges={Platform.OS === "android"}
        anchor={{ x: 0.5, y: 1 }}
      >
        <View style={styles.container}>
          {/* Label Chip */}
          <View style={styles.chip}>
            <Text style={styles.chipText}>{label}</Text>
          </View>

          {/* Icon Pin */}
          <View style={styles.pin}>
            <Ionicons name="home" size={16} color="#FFFFFF" />
          </View>

          {/* Pointer needle */}
          <View style={styles.triangle} />
        </View>
      </Marker>
    );
  }
);

CustomerMarker.displayName = "CustomerMarker";

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  chip: {
    backgroundColor: "#1F1010",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  chipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#16A34A", // Vibrant delivery green
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#16A34A",
    marginTop: -1,
  },
});
