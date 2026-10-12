import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/useTheme";

export default function ComingSoon() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.primaryLight }]}>
          <Ionicons name="time-outline" size={55} color={theme.primary} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Coming Soon</Text>

        <Text style={[styles.description, { color: theme.secondaryText }]}>
          We're working on something amazing.
          {"\n"}
          Stay tuned!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 12,
  },

  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
});
