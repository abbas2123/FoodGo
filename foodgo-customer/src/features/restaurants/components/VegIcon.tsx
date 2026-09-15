import React from "react";
import { View, StyleSheet } from "react-native";

interface VegIconProps {
  isVeg: boolean;
}

export const VegIcon: React.FC<VegIconProps> = ({ isVeg }) => {
  return (
    <View
      style={[
        styles.vegIcon,
        { borderColor: isVeg ? "#16A34A" : "#C1121F" },
      ]}
    >
      <View
        style={[
          styles.vegDot,
          { backgroundColor: isVeg ? "#16A34A" : "#C1121F" },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  vegIcon: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default VegIcon;
