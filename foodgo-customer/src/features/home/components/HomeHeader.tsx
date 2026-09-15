import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useTheme } from "@/theme/useTheme";

interface HomeHeaderProps {
  onLocationPress?: () => void;
  onNotificationPress?: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onLocationPress,
  onNotificationPress,
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 500;
  const horizontalPadding = isSmallScreen ? 20 : 60;
  const { theme } = useTheme();

  const displayLocation = useAppSelector((state) => state.location.displayLocation);
  const locality = useAppSelector((state) => state.location.locality);
  const city = useAppSelector((state) => state.location.city);
  const district = useAppSelector((state) => state.location.district);
  const region = useAppSelector((state) => state.location.state);
  const address = useAppSelector((state) => state.location.address);
  const locationLoading = useAppSelector((state) => state.location.loading);
  const locationError = useAppSelector((state) => state.location.error);
  const permissionGranted = useAppSelector(
    (state) => state.location.permissionGranted,
  );
  const label =
    useAppSelector((state) => state.location.label) || "Delivering to";
  const notificationCount = useAppSelector(
    (state) => state.ui.notificationCount,
  );

  let displayAddress: string;
  if (locationLoading) {
    displayAddress = "Detecting location...";
  } else if (!permissionGranted && locationError) {
    displayAddress = "Location unavailable";
  } else if (displayLocation) {
    displayAddress = displayLocation;
  } else if (locality && region) {
    displayAddress = `${locality}, ${region}`;
  } else if (city && region) {
    displayAddress = `${city}, ${region}`;
  } else if (district && region) {
    displayAddress = `${district}, ${region}`;
  } else if (locality) {
    displayAddress = locality;
  } else if (city) {
    displayAddress = city;
  } else if (district) {
    displayAddress = district;
  } else if (region) {
    displayAddress = region;
  } else if (address) {
    displayAddress = address;
  } else if (locationError) {
    displayAddress = "Unable to get location";
  } else {
    displayAddress = "Select location";
  }

  return (
    <View
      style={[
        styles.header,
        {
          paddingHorizontal: horizontalPadding,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Pressable style={styles.locationSection} onPress={onLocationPress}>
        <Ionicons
          name="location"
          size={isSmallScreen ? 32 : 42}
          color={theme.primary}
        />

        <View style={styles.locationText}>
          <Text
            style={[
              styles.deliveringText,
              {
                color: theme.secondaryText,
                fontSize: isSmallScreen ? 16 : 30,
              },
            ]}
          >
            {label}
          </Text>

          <View style={styles.addressRow}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.addressText,
                {
                  color: theme.text,
                  fontSize: isSmallScreen ? 22 : 42,
                  maxWidth: width * 0.62,
                },
              ]}
            >
              {displayAddress}
            </Text>

            <Ionicons
              name="chevron-down"
              size={isSmallScreen ? 18 : 25}
              color={theme.icon}
            />
          </View>
        </View>
      </Pressable>

      <Pressable style={styles.notificationButton} onPress={onNotificationPress}>
        <Ionicons
          name="notifications-outline"
          size={isSmallScreen ? 30 : 43}
          color={theme.primary}
        />

        {notificationCount > 0 && (
          <View
            style={[
              styles.notificationDot,
              {
                width: isSmallScreen ? 9 : 14,
                height: isSmallScreen ? 9 : 14,
                borderRadius: isSmallScreen ? 4.5 : 7,
              },
            ]}
          />
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    minHeight: 105,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locationSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  locationText: {
    flex: 1,
    marginLeft: 14,
    minWidth: 0,
  },
  deliveringText: {
    marginBottom: 2,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  addressText: {
    fontWeight: "700",
  },
  notificationButton: {
    position: "relative",
    padding: 5,
    marginLeft: 10,
  },
  notificationDot: {
    position: "absolute",
    top: 2,
    right: 0,
    backgroundColor: "#C1121F",
  },
});
