import React, { useState } from "react";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { StyleSheet, ScrollView, View } from "react-native";
import {
  HomeHeader,
  SearchBar,
  SpecialOfferBanner,
  CategoryList,
  PopularDishes,
  NearByRestorent,
  NotificationModal,
  DeliveryAddressModal,
} from "@/features/home/components";
import { useTheme } from "@/theme/useTheme";

export default function HomePage() {
  const { refetch: refetchLocation } = useCurrentLocation();
  const { theme } = useTheme();
  const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HomeHeader
          onLocationPress={() => setIsLocationModalVisible(true)}
          onNotificationPress={() => setIsNotificationModalVisible(true)}
        />
        <SearchBar />
        <SpecialOfferBanner />
        <CategoryList />
        <PopularDishes />
        <NearByRestorent />
      </ScrollView>

      <NotificationModal
        visible={isNotificationModalVisible}
        onClose={() => setIsNotificationModalVisible(false)}
      />

      <DeliveryAddressModal
        visible={isLocationModalVisible}
        onClose={() => setIsLocationModalVisible(false)}
        onUseCurrentLocation={refetchLocation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
});
