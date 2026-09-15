/**
 * OrderTrackingScreen
 *
 * Swiggy-style Live Food Delivery Tracking Screen.
 *
 * Features:
 *   • Full-screen interactive MapView with custom delivery map themes (Light & Dark).
 *   • Custom markers: Restaurant (🍴), Customer (🏠), and Delivery Partner (🛵).
 *   • Real road-following navigation route (Google Directions / high-density street network).
 *   • Smoothly moving delivery partner marker with dynamic heading/bearing rotation.
 *   • Automatic camera tracking with user-pan pause and floating Recenter control (◎).
 *   • Live dynamic ETA & distance remaining calculation.
 *   • Delivery Partner profile with direct phone call action.
 *   • Bottom tracking sheet with live order status and order preview.
 *   • Production-ready real-time subscription interface with development simulator.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import MapView from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import type { Coordinates, DeliveryTracking, Order } from "@/types/order.types";
import { isActiveOrder } from "@/types/order.types";

import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { fetchOrderById, fetchOrderTracking } from "@/store/slices/ordersSlice";
import {
  getDeliveryRoute,
  subscribeOrderTracking,
  formatDistance,
  formatETA,
} from "@/features/orders/services/tracking.service";
import { TrackingMapView } from "@/features/orders/components/tracking/TrackingMapView";
import { RecenterButton } from "@/features/orders/components/tracking/RecenterButton";
import { TrackingBottomSheet } from "@/features/orders/components/tracking/TrackingBottomSheet";

type TrackOrderRouteProp = RouteProp<AppStackParamList, "TrackOrderDetails">;

export default function TrackingOrderPage() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<TrackOrderRouteProp>();
  const dispatch = useAppDispatch();

  const mapRef = useRef<MapView | null>(null);

  // 1. Resolve Active Order from Redux Store or params
  const orderId = route.params?.orderId;
  const storeCurrentOrder = useAppSelector((state) => state.orders.currentOrder);
  const storeOrders = useAppSelector((state) => state.orders.orders);
  const trackingData = useAppSelector((state) => state.orders.trackingData);

  useEffect(() => {
    if (orderId) {
      dispatch(fetchOrderById(orderId));
      dispatch(fetchOrderTracking(orderId));
    }
  }, [orderId, dispatch]);

  const order: Order | undefined =
    (storeCurrentOrder && String(storeCurrentOrder.id) === String(orderId)
      ? storeCurrentOrder
      : undefined) ??
    storeOrders.find((o) => String(o.id) === String(orderId)) ??
    storeOrders.find((o) => isActiveOrder(o.status)) ??
    undefined;

  // Null-guard: show loading while order is being fetched from backend
  if (!order) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background }}>
        <Ionicons name="bicycle-outline" size={48} color={theme.muted} />
        <Text style={{ color: theme.muted, marginTop: 12, fontSize: 15 }}>Loading tracking info...</Text>
      </View>
    );
  }

  // Coordinates from backend trackingData or order
  const restaurantLocation: Coordinates =
    (trackingData?.restaurant?.latitude && trackingData?.restaurant?.longitude
      ? {
          latitude: trackingData.restaurant.latitude,
          longitude: trackingData.restaurant.longitude,
        }
      : null) ||
    order.restaurant.location || {
      latitude: 12.9719,
      longitude: 77.6412,
    };

  const customerLocation: Coordinates =
    (trackingData?.deliveryLocation?.latitude && trackingData?.deliveryLocation?.longitude
      ? {
          latitude: trackingData.deliveryLocation.latitude,
          longitude: trackingData.deliveryLocation.longitude,
        }
      : null) ||
    order.deliveryAddress.location || {
      latitude: 12.9756,
      longitude: 77.6192,
    };

  // 2. Live Tracking State
  const [deliveryPartnerLocation, setDeliveryPartnerLocation] =
    useState<Coordinates | null>(
      order.tracking?.deliveryPartnerLocation || restaurantLocation
    );
  const [deliveryPartnerHeading, setDeliveryPartnerHeading] = useState<number>(
    order.tracking?.deliveryPartnerHeading || 280
  );
  const [activeRouteCoordinates, setActiveRouteCoordinates] = useState<
    Coordinates[]
  >([]);
  const [traveledCoordinates, setTraveledCoordinates] = useState<
    Coordinates[]
  >([]);
  const [etaText, setEtaText] = useState<string>(
    order.tracking?.estimatedArrival || "10–15 min"
  );
  const [distanceText, setDistanceText] = useState<string>(
    order.tracking?.distanceRemainingMeters
      ? formatDistance(order.tracking.distanceRemainingMeters)
      : "2.4 km away"
  );
  const [isFollowingMode, setIsFollowingMode] = useState<boolean>(true);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  // 3. Load Initial Road-Following Route
  useEffect(() => {
    let isMounted = true;

    getDeliveryRoute(restaurantLocation, customerLocation)
      .then((routeResult) => {
        if (!isMounted) return;

        setActiveRouteCoordinates(routeResult.coordinates);
        setDistanceText(formatDistance(routeResult.distanceMeters));
        setEtaText(formatETA(routeResult.durationSeconds));

        // Initial camera framing
        if (mapRef.current && routeResult.coordinates.length > 0) {
          mapRef.current.fitToCoordinates(routeResult.coordinates, {
            edgePadding: {
              top: 100,
              right: 40,
              bottom: 300,
              left: 40,
            },
            animated: true,
          });
        }
      })
      .catch((err) => {
        console.warn("Failed to load delivery route:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [restaurantLocation.latitude, customerLocation.latitude]);

  // 4. Initial Camera Fit when Map is ready
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    if (activeRouteCoordinates.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(activeRouteCoordinates, {
        edgePadding: {
          top: 100,
          right: 40,
          bottom: 300,
          left: 40,
        },
        animated: false,
      });
    }
  }, [activeRouteCoordinates]);

  // 5. Real-Time Tracking Subscription
  useEffect(() => {
    const initialTracking: DeliveryTracking = {
      restaurantLocation,
      customerLocation,
      deliveryPartnerLocation: deliveryPartnerLocation || restaurantLocation,
      deliveryPartnerHeading,
      routeCoordinates: activeRouteCoordinates,
      deliveryPartner: order.tracking?.deliveryPartner,
    };

    const unsubscribe = subscribeOrderTracking(
      order.id,
      initialTracking,
      (update) => {
        if (update.deliveryPartnerLocation) {
          setDeliveryPartnerLocation(update.deliveryPartnerLocation);

          // Animate camera to courier if user hasn't panned away
          if (isFollowingMode && mapRef.current) {
            mapRef.current.animateCamera(
              {
                center: update.deliveryPartnerLocation,
                zoom: 16,
              },
              { duration: 1200 }
            );
          }
        }

        if (update.deliveryPartnerHeading !== undefined) {
          setDeliveryPartnerHeading(update.deliveryPartnerHeading);
        }

        if (update.distanceRemainingMeters !== undefined) {
          setDistanceText(formatDistance(update.distanceRemainingMeters));
        }

        if (update.estimatedArrival) {
          setEtaText(update.estimatedArrival);
        }

        if (update.routeCoordinates) {
          setActiveRouteCoordinates(update.routeCoordinates);
        }

        if (update.traveledCoordinates) {
          setTraveledCoordinates(update.traveledCoordinates);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [order.id, isFollowingMode, activeRouteCoordinates.length]);

  // 6. User interaction on map disables auto-follow
  const handleUserInteraction = useCallback(() => {
    setIsFollowingMode(false);
  }, []);

  // 7. Recenter camera on delivery partner
  const handleRecenter = useCallback(() => {
    setIsFollowingMode(true);
    if (deliveryPartnerLocation && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: deliveryPartnerLocation,
          zoom: 16.5,
        },
        { duration: 1000 }
      );
    }
  }, [deliveryPartnerLocation]);

  // 8. Navigate to full order details
  const handleViewOrderDetails = useCallback(() => {
    navigation.navigate("OrderDetails", { orderId: order.id });
  }, [navigation, order.id]);

  const topInset = Math.max(insets.top, 12);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* ─── Full-Screen Interactive Map ───────────────────────────────────── */}
      <TrackingMapView
        ref={mapRef}
        restaurantLocation={restaurantLocation}
        restaurantName={order.restaurant.name}
        customerLocation={customerLocation}
        customerLabel={order.deliveryAddress.label}
        deliveryPartnerLocation={deliveryPartnerLocation}
        deliveryPartnerHeading={deliveryPartnerHeading}
        deliveryPartnerName={
          order.tracking?.deliveryPartner?.name || "Delivery Partner"
        }
        activeRouteCoordinates={activeRouteCoordinates}
        traveledCoordinates={traveledCoordinates}
        onUserInteraction={handleUserInteraction}
        onMapReady={handleMapReady}
      />

      {/* ─── Floating Header Controls ─────────────────────────────────────── */}
      <View style={[styles.headerBar, { top: topInset }]}>
        {/* Back Button */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.floatingBtn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        {/* Order Status Badge */}
        <View
          style={[
            styles.orderBadge,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.liveDot} />
          <Text style={[styles.orderBadgeText, { color: theme.text }]}>
            Live • Order #{order.orderNumber}
          </Text>
        </View>

        {/* Info / Receipt Button */}
        <Pressable
          onPress={handleViewOrderDetails}
          style={({ pressed }) => [
            styles.floatingBtn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          hitSlop={10}
        >
          <Ionicons name="receipt-outline" size={20} color={theme.text} />
        </Pressable>
      </View>

      {/* ─── Floating Recenter Map Button ─────────────────────────────────── */}
      <View style={styles.recenterContainer}>
        <RecenterButton
          onPress={handleRecenter}
          isFollowing={isFollowingMode}
        />
      </View>

      {/* ─── Swiggy-Style Bottom Sheet ────────────────────────────────────── */}
      <TrackingBottomSheet
        order={order}
        status={order.status}
        etaText={etaText}
        distanceText={distanceText}
        deliveryPartner={order.tracking?.deliveryPartner}
        onViewOrderDetails={handleViewOrderDetails}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  floatingBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  orderBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },
  orderBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  recenterContainer: {
    position: "absolute",
    right: 20,
    bottom: 270, // Positioned right above the bottom sheet
    zIndex: 10,
  },
});
