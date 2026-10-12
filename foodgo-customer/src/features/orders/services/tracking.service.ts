/**
 * Tracking Service
 *
 * Real-time backend-driven order tracking service.
 * Connects to the FoodiGo backend tracking endpoints via periodic polling
 * with in-flight lock, exponential backoff, and terminal state cancellation.
 *
 * Strictly NO hardcoded Bangalore coordinates or local simulation timers.
 */

import type { Coordinates } from "@/types/order.types";
import { ordersApi } from "@/api/orders/ordersApi";

export interface DeliveryRouteResult {
  coordinates: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
}

export interface BackendTrackingData {
  orderId: string;
  orderNumber?: string;
  status: string;
  statusLabel?: string;
  isDriverAssigned: boolean;
  hasDriverLocation: boolean;
  isLocationStale: boolean;
  driverUpdatedAt: string | null;
  driver: {
    id: string | null;
    name: string;
    phone: string | null;
    rating: number | null;
    location: {
      latitude: number;
      longitude: number;
      heading?: number;
      updatedAt?: string | null;
    } | null;
  } | null;
  restaurant: {
    id: string;
    name: string;
    location: Coordinates | null;
  };
  deliveryLocation: {
    latitude: number | null;
    longitude: number | null;
    address: string;
  } | null;
}

export interface TrackingSubscriptionOptions {
  pollingIntervalMs?: number;
  onError?: (error: any) => void;
}

/**
 * Decode Google Encoded Polyline algorithm into an array of Coordinates.
 */
export function decodePolyline(encoded: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

/**
 * Calculates bearing (heading) in degrees (0 - 360) from start to end coordinate.
 */
export function calculateBearing(start: Coordinates, end: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(start.latitude);
  const lat2 = toRad(end.latitude);
  const dLng = toRad(end.longitude - start.longitude);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(bearing);
}

/**
 * Calculates Haversine distance in meters between two coordinates.
 */
export function calculateDistanceMeters(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLng = toRad(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Formats seconds into human-friendly ETA text (e.g. "10–15 min").
 */
export function formatETA(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes <= 3) return "Arriving in 2–3 min";
  if (minutes <= 7) return `Arriving in ${minutes - 2}–${minutes} min`;
  return `Arriving in ${minutes - 3}–${minutes + 2} min`;
}

/**
 * Formats distance in meters to a readable string (e.g. "1.8 km away" or "450 m away").
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m away`;
  }
  return `${(meters / 1000).toFixed(1)} km away`;
}

/**
 * Fetches the road-following delivery route between origin and destination.
 * Uses Google Directions API if configured; otherwise generates a direct geodetic path
 * connecting actual origin and destination. Never fabricates Bangalore coordinates.
 */
export async function getDeliveryRoute(
  origin: Coordinates,
  destination: Coordinates
): Promise<DeliveryRouteResult> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs?.[0];
        const encodedPolyline = route.overview_polyline?.points;
        const decoded = encodedPolyline ? decodePolyline(encodedPolyline) : [];

        if (decoded.length > 0) {
          return {
            coordinates: decoded,
            distanceMeters: leg?.distance?.value ?? 2400,
            durationSeconds: leg?.duration?.value ?? 720,
          };
        }
      }
    } catch (err) {
      console.warn("Google Directions API failed, using geodetic path:", err);
    }
  }

  // Fallback: Geodetic line directly between the true origin and destination
  const distance = calculateDistanceMeters(origin, destination);
  // Estimate travel time at ~20 km/h city average speed (5.5 m/s)
  const durationSeconds = Math.max(180, Math.round(distance / 5.5));

  return {
    coordinates: [origin, destination],
    distanceMeters: distance,
    durationSeconds,
  };
}

/**
 * Subscribes to backend-driven live order tracking using authenticated polling.
 *
 * Requirements enforced:
 *   - No fake coordinate progression or setInterval timers simulating roads.
 *   - In-flight request lock prevents overlapping network traffic.
 *   - Stops polling automatically when an order reaches terminal status (DELIVERED/CANCELLED).
 *   - Cleans up timers when component unmounts.
 *   - Applies bounded exponential backoff on network failures.
 */
export function subscribeOrderTracking(
  orderId: string | number,
  onUpdate: (data: BackendTrackingData) => void,
  options?: TrackingSubscriptionOptions
): () => void {
  const baseIntervalMs = options?.pollingIntervalMs ?? 10000; // 10 seconds default
  let currentIntervalMs = baseIntervalMs;
  let isCancelled = false;
  let isFetching = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let failureCount = 0;

  const poll = async () => {
    if (isCancelled) return;
    if (isFetching) {
      // Previous request still in flight, reschedule
      timerId = setTimeout(poll, currentIntervalMs);
      return;
    }

    isFetching = true;

    try {
      const response = await ordersApi.getOrderTracking(orderId);
      if (isCancelled) return;

      if (response.success && response.data) {
        failureCount = 0;
        currentIntervalMs = baseIntervalMs; // Reset backoff on success

        const tracking = response.data as BackendTrackingData;
        onUpdate(tracking);

        // Terminal status: stop polling immediately
        const terminalStatuses = ["DELIVERED", "CANCELLED"];
        if (terminalStatuses.includes(tracking.status)) {
          isCancelled = true;
          return;
        }
      }
    } catch (err) {
      if (isCancelled) return;
      failureCount++;
      // Exponential backoff capped at 30 seconds
      currentIntervalMs = Math.min(30000, baseIntervalMs * Math.pow(1.5, Math.min(failureCount, 3)));
      if (options?.onError) {
        options.onError(err);
      }
    } finally {
      isFetching = false;
      if (!isCancelled) {
        timerId = setTimeout(poll, currentIntervalMs);
      }
    }
  };

  // Run immediate first poll
  poll();

  return () => {
    isCancelled = true;
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
}
