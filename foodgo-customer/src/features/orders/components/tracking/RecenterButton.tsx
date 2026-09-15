import React from "react";
import { StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/useTheme";

interface RecenterButtonProps {
  onPress: () => void;
  isFollowing?: boolean;
}

export const RecenterButton: React.FC<RecenterButtonProps> = React.memo(
  ({ onPress, isFollowing = false }) => {
    const { theme } = useTheme();

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.surface,
            borderColor: isFollowing ? theme.primary : theme.border,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
        hitSlop={8}
      >
        <Ionicons
          name={isFollowing ? "locate" : "locate-outline"}
          size={22}
          color={isFollowing ? theme.primary : theme.text}
        />
      </Pressable>
    );
  }
);

RecenterButton.displayName = "RecenterButton";

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
