import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ReverseGeocodeResponse {
  latitude: number;
  longitude: number;
  locality: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  formattedAddress: string | null;
  displayLocation: string;
}

export interface AutocompleteSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResult {
  address_components: GoogleAddressComponent[];
  formatted_address: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  place_id?: string;
}

interface GoogleGeocodeApiResponse {
  results: GoogleGeocodeResult[];
  status: string;
  error_message?: string;
}

interface GooglePlacesAutocompletePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
}

interface GooglePlacesAutocompleteResponse {
  predictions: GooglePlacesAutocompletePrediction[];
  status: string;
  error_message?: string;
}

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY') ?? '';
  }

  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResponse> {
    if (!this.apiKey) {
      this.logger.error('GOOGLE_MAPS_API_KEY is not configured');
      throw new ServiceUnavailableException(
        'Geocoding service is currently unavailable',
      );
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.apiKey}`;

    let responseData: GoogleGeocodeApiResponse;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Google API HTTP error: ${response.status}`);
      }

      responseData = (await response.json()) as GoogleGeocodeApiResponse;
    } catch (error) {
      const isAbort = (error as Error)?.name === 'AbortError';
      this.logger.error(
        `Failed to reach Google Geocoding API: ${isAbort ? 'Timeout' : (error as Error)?.message}`,
      );
      throw new ServiceUnavailableException(
        'Geocoding service is currently unavailable',
      );
    }

    if (responseData.status === 'ZERO_RESULTS') {
      return {
        latitude,
        longitude,
        locality: null,
        city: null,
        district: null,
        state: null,
        country: null,
        postalCode: null,
        formattedAddress: null,
        displayLocation: 'Current location',
      };
    }

    if (responseData.status !== 'OK' || !responseData.results?.length) {
      this.logger.error(
        `Google Geocoding API returned status: ${responseData.status}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve address from geocoding provider',
      );
    }

    return this.parseGeocodeResults(latitude, longitude, responseData.results);
  }

  async autocomplete(query: string): Promise<AutocompleteSuggestion[]> {
    if (!this.apiKey) {
      this.logger.error('GOOGLE_MAPS_API_KEY is not configured');
      throw new ServiceUnavailableException(
        'Geocoding service is currently unavailable',
      );
    }

    const placesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      query,
    )}&key=${this.apiKey}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(placesUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data =
          (await response.json()) as GooglePlacesAutocompleteResponse;

        if (data.status === 'OK' && data.predictions?.length) {
          return data.predictions.map((p) => ({
            placeId: p.place_id,
            mainText: p.structured_formatting?.main_text ?? p.description,
            secondaryText: p.structured_formatting?.secondary_text ?? '',
            description: p.description,
          }));
        }

        if (data.status === 'ZERO_RESULTS') {
          return [];
        }
      }
    } catch {
      // Fallback to geocoding API
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      query,
    )}&key=${this.apiKey}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(geocodeUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as GoogleGeocodeApiResponse;

      if (data.status === 'OK' && data.results?.length) {
        return data.results.slice(0, 5).map((r) => {
          const mainName =
            r.address_components[0]?.long_name ?? r.formatted_address;
          return {
            placeId: r.place_id ?? `geo_${Math.random()}`,
            mainText: mainName,
            secondaryText: r.formatted_address,
            description: r.formatted_address,
          };
        });
      }

      return [];
    } catch {
      return [];
    }
  }

  async getPlaceDetails(placeId: string): Promise<ReverseGeocodeResponse> {
    if (!this.apiKey) {
      this.logger.error('GOOGLE_MAPS_API_KEY is not configured');
      throw new ServiceUnavailableException(
        'Geocoding service is currently unavailable',
      );
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(
      placeId,
    )}&key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let responseData: GoogleGeocodeApiResponse;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Google API HTTP error: ${response.status}`);
      }

      responseData = (await response.json()) as GoogleGeocodeApiResponse;
    } catch (error) {
      const isAbort = (error as Error)?.name === 'AbortError';
      this.logger.error(
        `Failed to reach Google Geocoding API: ${isAbort ? 'Timeout' : (error as Error)?.message}`,
      );
      throw new ServiceUnavailableException(
        'Geocoding service is currently unavailable',
      );
    }

    if (responseData.status !== 'OK' || !responseData.results?.length) {
      throw new InternalServerErrorException(
        'Failed to retrieve place details from geocoding provider',
      );
    }

    const result = responseData.results[0];
    const lat = result.geometry?.location?.lat ?? 0;
    const lng = result.geometry?.location?.lng ?? 0;

    return this.parseGeocodeResults(lat, lng, responseData.results);
  }

  parseGeocodeResults(
    latitude: number,
    longitude: number,
    results: GoogleGeocodeResult[],
  ): ReverseGeocodeResponse {
    const componentMap = new Map<string, string>();

    for (const result of results) {
      for (const component of result.address_components) {
        for (const type of component.types) {
          if (!componentMap.has(type)) {
            componentMap.set(type, component.long_name);
          }
        }
      }
    }

    const sublocalityL1 = componentMap.get('sublocality_level_1') ?? null;
    const sublocalityL2 = componentMap.get('sublocality_level_2') ?? null;
    const sublocalityL3 = componentMap.get('sublocality_level_3') ?? null;
    const sublocalityL4 = componentMap.get('sublocality_level_4') ?? null;
    const sublocality = componentMap.get('sublocality') ?? null;
    const neighborhood = componentMap.get('neighborhood') ?? null;
    const locality = componentMap.get('locality') ?? null;
    const postalTown = componentMap.get('postal_town') ?? null;
    const adminAreaL3 = componentMap.get('administrative_area_level_3') ?? null;
    const adminAreaL2 = componentMap.get('administrative_area_level_2') ?? null;
    const adminAreaL1 = componentMap.get('administrative_area_level_1') ?? null;
    const country = componentMap.get('country') ?? null;
    const postalCode = componentMap.get('postal_code') ?? null;

    const mostGranularLocality =
      sublocalityL1 ??
      sublocalityL2 ??
      sublocalityL3 ??
      sublocalityL4 ??
      sublocality ??
      neighborhood ??
      locality ??
      null;

    const resolvedCity =
      locality ??
      postalTown ??
      adminAreaL3 ??
      null;

    const district = adminAreaL2;
    const state = adminAreaL1;

    let displayLocation = 'Current location';
    if (mostGranularLocality && state && mostGranularLocality !== state) {
      displayLocation = `${mostGranularLocality}, ${state}`;
    } else if (mostGranularLocality) {
      displayLocation = mostGranularLocality;
    } else if (resolvedCity && state && resolvedCity !== state) {
      displayLocation = `${resolvedCity}, ${state}`;
    } else if (resolvedCity) {
      displayLocation = resolvedCity;
    } else if (district && state && district !== state) {
      displayLocation = `${district}, ${state}`;
    } else if (state) {
      displayLocation = state;
    } else if (results[0]?.formatted_address) {
      displayLocation = results[0].formatted_address;
    }

    return {
      latitude,
      longitude,
      locality: mostGranularLocality,
      city: resolvedCity,
      district,
      state,
      country,
      postalCode,
      formattedAddress: results[0]?.formatted_address ?? null,
      displayLocation,
    };
  }
}
