import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useTheme } from "@/theme/useTheme";

interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.categoryTabsWrapper,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabs}
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <Pressable
              key={cat}
              style={[
                styles.categoryTab,
                {
                  backgroundColor: isActive
                    ? theme.primary
                    : isDark
                      ? theme.card
                      : "#F3F4F6",
                  borderColor: isActive
                    ? theme.primary
                    : isDark
                      ? theme.border
                      : "transparent",
                  borderWidth: isDark ? 1 : 0,
                },
              ]}
              onPress={() => onSelectCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  {
                    color: isActive ? "#FFFFFF" : theme.secondaryText,
                    fontWeight: isActive ? "700" : "600",
                  },
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  categoryTabsWrapper: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginTop: 8,
  },
  categoryTabs: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  categoryTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  categoryTabActive: {
    backgroundColor: "#C1121F",
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  categoryTabTextActive: {
    color: "#fff",
  },
});

export default CategoryTabs;
