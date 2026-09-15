import * as Location from 'expo-location';
import { apiClient } from '@/api/client/apiClient';
import { API_ENDPOINTS } from '@/api/client/apiConfig';

export interface LocationResult {
  latitude: number;
  longitude: number;
  street?: string | null;
  name?: string | null;
  locality?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  formattedAddress?: string | null;
  displayLocation?: string | null;
  address?: string;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function requestForegroundPermission(): Promise<LocationPermissionStatus> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status as LocationPermissionStatus;
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<LocationResult> {
  try {
    const response = await apiClient.get(
      API_ENDPOINTS.LOCATION.REVERSE_GEOCODE,
      {
        params: { latitude, longitude },
      },
    );

    const data = response.data?.data ?? response.data;

    if (data && typeof data === 'object') {
      return {
        latitude,
        longitude,
        street: data.street ?? data.locality ?? null,
        name: data.name ?? null,
        locality: data.locality ?? null,
        city: data.city ?? null,
        district: data.district ?? null,
        state: data.state ?? null,
        country: data.country ?? null,
        postalCode: data.postalCode ?? null,
        formattedAddress: data.formattedAddress ?? null,
        displayLocation: data.displayLocation ?? null,
        address: data.displayLocation || data.formattedAddress || 'Current location',
      };
    }
  } catch (backendError) {
    console.warn('[Location] Backend geocoding request failed:', backendError);
  }

  try {
    const [geocoded] = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (geocoded) {
      const streetPart = [geocoded.streetNumber, geocoded.street || geocoded.name]
        .filter(Boolean)
        .join(' ');
      const locality = geocoded.subregion || geocoded.city || geocoded.name || '';
      const state = geocoded.region || '';
      const display = streetPart
        ? `${streetPart}, ${locality ? locality + ', ' : ''}${state}`
        : locality && state
        ? `${locality}, ${state}`
        : locality || state || 'Current location';

      return {
        latitude,
        longitude,
        street: streetPart || null,
        name: geocoded.name ?? null,
        locality,
        city: geocoded.city ?? null,
        district: geocoded.district ?? null,
        state,
        country: geocoded.country ?? null,
        postalCode: geocoded.postalCode ?? null,
        formattedAddress: display,
        displayLocation: display,
        address: display,
      };
    }
  } catch (expoError) {
    console.warn('[Location] Expo fallback geocoding failed:', expoError);
  }

  return {
    latitude,
    longitude,
    displayLocation: 'Current location',
    address: 'Current location',
  };
}

export async function getCurrentLocation(): Promise<LocationResult> {
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { latitude, longitude } = position.coords;
  return reverseGeocodeCoordinates(latitude, longitude);
}

export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

export interface PlaceDetailsResult {
  latitude: number;
  longitude: number;
  locality?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  formattedAddress?: string | null;
  displayLocation?: string | null;
}

export async function fetchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const response = await apiClient.get(API_ENDPOINTS.LOCATION.AUTOCOMPLETE, {
      params: { query: trimmed },
    });
    const data = response.data?.data ?? response.data;
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (err) {
    console.warn('[Location] Autocomplete failed:', err);
    return [];
  }
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
  try {
    const response = await apiClient.get(API_ENDPOINTS.LOCATION.PLACE_DETAILS, {
      params: { placeId },
    });
    const details = response.data?.data ?? response.data;
    if (
      details &&
      typeof details === 'object' &&
      typeof details.latitude === 'number' &&
      typeof details.longitude === 'number'
    ) {
      return details as PlaceDetailsResult;
    }
    return null;
  } catch (err) {
    console.warn('[Location] Place details failed:', err);
    return null;
  }
}

export async function geocodeAddress(
  addressText: string,
): Promise<{ latitude: number; longitude: number; details?: PlaceDetailsResult } | null> {
  const trimmed = addressText.trim();
  if (!trimmed) return null;

  // 1. Try backend autocomplete -> place details
  try {
    const suggestions = await fetchPlaceSuggestions(trimmed);
    if (suggestions.length > 0 && suggestions[0].placeId) {
      const details = await fetchPlaceDetails(suggestions[0].placeId);
      if (details && typeof details.latitude === 'number' && typeof details.longitude === 'number') {
        return {
          latitude: details.latitude,
          longitude: details.longitude,
          details,
        };
      }
    }
  } catch (backendErr) {
    console.warn('[Location] Backend geocoding via autocomplete failed:', backendErr);
  }

  // 2. Fallback to Expo forward geocodeAsync (works without GPS permission)
  try {
    const results = await Location.geocodeAsync(trimmed);
    if (results && results.length > 0) {
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
    }
  } catch (expoErr) {
    console.warn('[Location] Expo geocodeAsync failed:', expoErr);
  }

  return null;
}

