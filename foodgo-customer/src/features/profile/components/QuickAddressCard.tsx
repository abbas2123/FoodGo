import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../theme/useTheme";

interface Props {
  label: string;
  address: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export default function QuickAddressCard({
  label,
  address,
  iconName = "home-outline",
  onPress,
}: Props) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.addressCard,
        { backgroundColor: theme.card },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
        <Ionicons name={iconName} size={20} color={theme.primary} />
      </View>

      <View style={styles.addressInfo}>
        <Text style={[styles.addressTitle, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.addressText, { color: theme.secondaryText }]} numberOfLines={2}>
          {address}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={theme.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addressCard: {
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },
  pressed: {
    opacity: 0.75,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  addressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  addressTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  addressText: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
});
