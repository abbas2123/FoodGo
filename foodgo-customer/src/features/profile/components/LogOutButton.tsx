import React from "react";
import { Pressable, Text, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onLogout: () => void;
}

export default function LogOutButton({ onLogout }: Props) {
  const handlePress = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: onLogout },
    ]);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <Ionicons name="log-out-outline" size={18} color="#e53935" />
      <Text style={styles.text}>Log Out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 44,
    backgroundColor: "#fde9e9",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#e53935",
  },
});
