import React, { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useTheme } from "@/theme/useTheme";
import type { Coordinates } from "@/types/order.types";
import { lightMapStyle, darkMapStyle } from "./mapStyles";
import { RestaurantMarker } from "./RestaurantMarker";
import { CustomerMarker } from "./CustomerMarker";
import { DeliveryPartnerMarker } from "./DeliveryPartnerMarker";

interface TrackingMapViewProps {
  restaurantLocation: Coordinates;
  restaurantName: string;
  customerLocation: Coordinates;
  customerLabel?: string;
  deliveryPartnerLocation?: Coordinates | null;
  deliveryPartnerHeading?: number;
  deliveryPartnerName?: string;
  activeRouteCoordinates?: Coordinates[];
  traveledCoordinates?: Coordinates[];
  onUserInteraction?: () => void;
  onMapReady?: () => void;
}

export const TrackingMapView = forwardRef<MapView, TrackingMapViewProps>(
  (
    {
      restaurantLocation,
      restaurantName,
      customerLocation,
      customerLabel = "Home",
      deliveryPartnerLocation,
      deliveryPartnerHeading = 0,
      deliveryPartnerName = "Delivery Partner",
      activeRouteCoordinates = [],
      traveledCoordinates = [],
      onUserInteraction,
      onMapReady,
    },
    ref
  ) => {
    const { theme, isDark } = useTheme();

    // Initial region centered between restaurant and customer
    const initialRegion = {
      latitude: (restaurantLocation.latitude + customerLocation.latitude) / 2,
      longitude:
        (restaurantLocation.longitude + customerLocation.longitude) / 2,
      latitudeDelta:
        Math.abs(restaurantLocation.latitude - customerLocation.latitude) * 2 +
        0.015,
      longitudeDelta:
        Math.abs(restaurantLocation.longitude - customerLocation.longitude) * 2 +
        0.015,
    };

    return (
      <View style={styles.container}>
        <MapView
          ref={ref}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          customMapStyle={isDark ? darkMapStyle : lightMapStyle}
          initialRegion={initialRegion}
          showsCompass={false}
          showsTraffic={false}
          showsBuildings={true}
          showsIndoorLevelPicker={false}
          showsPointsOfInterests={false}
          onPanDrag={onUserInteraction}
          onMapReady={onMapReady}
          mapPadding={{ top: 80, right: 20, bottom: 280, left: 20 }}
        >
          {/* Traveled Route (faded dashed line) */}
          {traveledCoordinates.length > 1 && (
            <Polyline
              coordinates={traveledCoordinates}
              strokeWidth={4}
              strokeColor={isDark ? "#555555" : "#A0A5B0"}
              lineDashPattern={[6, 6]}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Active Navigation Route (bold brand line) */}
          {activeRouteCoordinates.length > 1 && (
            <Polyline
              coordinates={activeRouteCoordinates}
              strokeWidth={5}
              strokeColor={theme.primary}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Restaurant Marker */}
          <RestaurantMarker
            coordinate={restaurantLocation}
            name={restaurantName}
          />

          {/* Customer / Home Marker */}
          <CustomerMarker
            coordinate={customerLocation}
            label={customerLabel}
          />

          {/* Live Moving Delivery Partner Marker */}
          {deliveryPartnerLocation && (
            <DeliveryPartnerMarker
              coordinate={deliveryPartnerLocation}
              heading={deliveryPartnerHeading}
              partnerName={deliveryPartnerName}
            />
          )}
        </MapView>
      </View>
    );
  }
);

TrackingMapView.displayName = "TrackingMapView";

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  map: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
