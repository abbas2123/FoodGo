import React from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { setSearchQuery, resetFilters } from "@/store/slices/uiSlice";
import { useTheme } from "@/theme/useTheme";

interface SearchBarProps {
  onFilterPress?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onFilterPress }) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 500;
  const horizontalPadding = isSmallScreen ? 20 : 60;
  const { theme } = useTheme();

  const dispatch = useAppDispatch();
  const searchQuery = useAppSelector((state) => state.ui.searchQuery);

  const handleFilter = () => {
    if (onFilterPress) {
      onFilterPress();
    } else {
      dispatch(resetFilters());
    }
  };

  return (
    <View
      style={[
        styles.searchWrapper,
        { paddingHorizontal: horizontalPadding },
      ]}
    >
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: theme.searchBackground,
            height: isSmallScreen ? 64 : 140,
            borderRadius: isSmallScreen ? 18 : 35,
            paddingLeft: isSmallScreen ? 18 : 45,
            paddingRight: isSmallScreen ? 8 : 20,
          },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={isSmallScreen ? 27 : 48}
          color={theme.secondaryText}
        />

        <TextInput
          style={[
            styles.searchInput,
            {
              color: theme.text,
              marginLeft: isSmallScreen ? 10 : 28,
              fontSize: isSmallScreen ? 16 : 32,
            },
          ]}
          placeholder="Search for restaurants or dishes"
          placeholderTextColor={theme.muted}
          returnKeyType="search"
          numberOfLines={1}
          value={searchQuery}
          onChangeText={(text) => dispatch(setSearchQuery(text))}
        />

        <Pressable
          style={[
            styles.filterButton,
            {
              width: isSmallScreen ? 54 : 90,
              height: isSmallScreen ? 54 : 90,
              borderRadius: isSmallScreen ? 15 : 25,
            },
          ]}
          onPress={handleFilter}
        >
          <Ionicons
            name="options-outline"
            size={isSmallScreen ? 23 : 34}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchWrapper: {
    paddingTop: 35,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
  },
  filterButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C1121F",
  },
});
