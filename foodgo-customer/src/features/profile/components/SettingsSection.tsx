import React from "react";
import { View, Text, StyleSheet, Switch, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../theme/useTheme";

export type SettingItem =
  | {
      id: string;
      type: "toggle";
      icon: keyof typeof Ionicons.glyphMap;
      title: string;
      value: boolean;
      onToggle: (next: boolean) => void;
    }
  | {
      id: string;
      type: "chevron";
      icon: keyof typeof Ionicons.glyphMap;
      title: string;
      value?: string;
      onPress?: () => void;
    };

interface Props {
  title: string;
  items: SettingItem[];
}

export default function SettingsSection({ title, items }: Props) {
  const { theme } = useTheme();

  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <View style={[styles.listCard, { backgroundColor: theme.card }]}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const borderStyle = !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
          };

          if (item.type === "toggle") {
            return (
              <View
                key={item.id}
                style={[styles.row, borderStyle]}
              >
                <View style={styles.left}>
                  <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons name={item.icon} size={18} color={theme.primary} />
                  </View>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
                </View>

                <Switch
                  value={item.value}
                  onValueChange={item.onToggle}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>
            );
          }

          return (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              disabled={!item.onPress}
              style={({ pressed }) => [
                styles.row,
                borderStyle,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={styles.left}>
                <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name={item.icon} size={18} color={theme.primary} />
                </View>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
              </View>

              <View style={styles.rightContent}>
                {item.value ? (
                  <Text style={[styles.valueText, { color: theme.secondaryText }]}>
                    {item.value}
                  </Text>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={theme.muted} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 10,
    marginLeft: 3,
  },
  listCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },
  row: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  valueText: {
    fontSize: 11,
  },
});
