import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";

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
  return (
    <View style={styles.categoryTabsWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabs}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.categoryTab,
              activeCategory === cat && styles.categoryTabActive,
            ]}
            onPress={() => onSelectCategory(cat)}
          >
            <Text
              style={[
                styles.categoryTabText,
                activeCategory === cat && styles.categoryTabTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
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
