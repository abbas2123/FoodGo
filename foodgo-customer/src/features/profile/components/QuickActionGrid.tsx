import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../theme/useTheme";

export interface QuickAction {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
}

interface Props {
  actions: QuickAction[];
}

export default function QuickActionGrid({ actions }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.grid}>
      {actions.map((item) => (
        <Pressable
          key={item.id}
          style={({ pressed }) => [
            styles.actionCard,
            { backgroundColor: theme.card },
            pressed && styles.pressed,
          ]}
          onPress={item.onPress}
        >
          <View style={[styles.actionIcon, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name={item.icon} size={22} color={theme.primary} />
          </View>
          <Text style={[styles.actionTitle, { color: theme.text }]}>{item.title}</Text>
          <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
            {item.subtitle}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
    marginTop: 16,
  },
  actionCard: {
    width: "48%",
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionSubtitle: {
    fontSize: 10,
    marginTop: 3,
  },
});
