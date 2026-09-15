import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LocationService } from './location.service.js';

describe('LocationService', () => {
  let service: LocationService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'GOOGLE_MAPS_API_KEY') return 'test-google-api-key';
        return null;
      }),
    } as unknown as ConfigService;

    service = new LocationService(configService);
  });

  describe('reverseGeocode', () => {
    it('throws ServiceUnavailableException when API key is missing', async () => {
      const serviceWithoutKey = new LocationService({
        get: vi.fn().mockReturnValue(''),
      } as unknown as ConfigService);

      await expect(
        serviceWithoutKey.reverseGeocode(9.164392, 76.667187),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('returns empty/neutral data when Google returns ZERO_RESULTS', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ZERO_RESULTS',
          results: [],
        }),
      });

      const result = await service.reverseGeocode(9.164392, 76.667187);
      expect(result).toEqual({
        latitude: 9.164392,
        longitude: 76.667187,
        locality: null,
        city: null,
        district: null,
        state: null,
        country: null,
        postalCode: null,
        formattedAddress: null,
        displayLocation: 'Current location',
      });
    });

    it('throws InternalServerErrorException when Google returns an error status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'REQUEST_DENIED',
          error_message: 'The provided API key is invalid.',
        }),
      });

      await expect(
        service.reverseGeocode(9.164392, 76.667187),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('throws ServiceUnavailableException when fetch fails or times out', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        service.reverseGeocode(9.164392, 76.667187),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('extracts granular sublocality and formats displayLocation accurately', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            {
              formatted_address:
                'Athikkattukulangara, Nooranad, Kerala 690504, India',
              address_components: [
                {
                  long_name: 'Athikkattukulangara',
                  short_name: 'Athikkattukulangara',
                  types: ['sublocality_level_1', 'sublocality', 'political'],
                },
                {
                  long_name: 'Mavelikkara',
                  short_name: 'Mavelikkara',
                  types: ['locality', 'political'],
                },
                {
                  long_name: 'Alappuzha',
                  short_name: 'Alappuzha',
                  types: ['administrative_area_level_2', 'political'],
                },
                {
                  long_name: 'Kerala',
                  short_name: 'KL',
                  types: ['administrative_area_level_1', 'political'],
                },
                {
                  long_name: 'India',
                  short_name: 'IN',
                  types: ['country', 'political'],
                },
                {
                  long_name: '690504',
                  short_name: '690504',
                  types: ['postal_code'],
                },
              ],
            },
          ],
        }),
      });

      const result = await service.reverseGeocode(9.164392, 76.667187);

      expect(result.latitude).toBe(9.164392);
      expect(result.longitude).toBe(76.667187);
      expect(result.locality).toBe('Athikkattukulangara');
      expect(result.city).toBe('Mavelikkara');
      expect(result.district).toBe('Alappuzha');
      expect(result.state).toBe('Kerala');
      expect(result.country).toBe('India');
      expect(result.postalCode).toBe('690504');
      expect(result.displayLocation).toBe('Athikkattukulangara, Kerala');
    });

    it('falls back gracefully to city when no sublocality is available', () => {
      const results = [
        {
          formatted_address: 'Mavelikkara, Kerala, India',
          types: ['street_address'],
          address_components: [
            {
              long_name: 'Mavelikkara',
              short_name: 'Mavelikkara',
              types: ['locality', 'political'],
            },
            {
              long_name: 'Alappuzha',
              short_name: 'Alappuzha',
              types: ['administrative_area_level_2', 'political'],
            },
            {
              long_name: 'Kerala',
              short_name: 'KL',
              types: ['administrative_area_level_1', 'political'],
            },
          ],
        },
      ];

      const parsed = service.parseGeocodeResults(9.164392, 76.667187, results);

      expect(parsed.locality).toBe('Mavelikkara');
      expect(parsed.city).toBe('Mavelikkara');
      expect(parsed.district).toBe('Alappuzha');
      expect(parsed.state).toBe('Kerala');
      expect(parsed.displayLocation).toBe('Mavelikkara, Kerala');
    });

    it('falls back to district when neither sublocality nor city are available', () => {
      const results = [
        {
          formatted_address: 'Alappuzha, Kerala, India',
          types: ['political'],
          address_components: [
            {
              long_name: 'Alappuzha',
              short_name: 'Alappuzha',
              types: ['administrative_area_level_2', 'political'],
            },
            {
              long_name: 'Kerala',
              short_name: 'KL',
              types: ['administrative_area_level_1', 'political'],
            },
          ],
        },
      ];

      const parsed = service.parseGeocodeResults(9.164392, 76.667187, results);

      expect(parsed.locality).toBeNull();
      expect(parsed.city).toBeNull();
      expect(parsed.district).toBe('Alappuzha');
      expect(parsed.state).toBe('Kerala');
      expect(parsed.displayLocation).toBe('Alappuzha, Kerala');
    });
  });

  describe('autocomplete', () => {
    it('returns predictions from Google Places autocomplete', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          predictions: [
            {
              place_id: 'place_123',
              description: 'Cherthala, Kerala, India',
              structured_formatting: {
                main_text: 'Cherthala',
                secondary_text: 'Kerala, India',
              },
            },
          ],
        }),
      });

      const results = await service.autocomplete('Cherthala');
      expect(results).toEqual([
        {
          placeId: 'place_123',
          mainText: 'Cherthala',
          secondaryText: 'Kerala, India',
          description: 'Cherthala, Kerala, India',
        },
      ]);
    });

    it('returns empty array when no results found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ZERO_RESULTS',
          predictions: [],
        }),
      });

      const results = await service.autocomplete('NonExistentPlaceXYZ');
      expect(results).toEqual([]);
    });
  });

  describe('getPlaceDetails', () => {
    it('fetches coordinates and parses address for a placeId', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            {
              formatted_address: 'Cherthala, Kerala, India',
              geometry: {
                location: {
                  lat: 9.6846,
                  lng: 76.3315,
                },
              },
              address_components: [
                {
                  long_name: 'Cherthala',
                  short_name: 'Cherthala',
                  types: ['locality', 'political'],
                },
                {
                  long_name: 'Alappuzha',
                  short_name: 'Alappuzha',
                  types: ['administrative_area_level_2', 'political'],
                },
                {
                  long_name: 'Kerala',
                  short_name: 'KL',
                  types: ['administrative_area_level_1', 'political'],
                },
              ],
            },
          ],
        }),
      });

      const details = await service.getPlaceDetails('place_123');
      expect(details.latitude).toBe(9.6846);
      expect(details.longitude).toBe(76.3315);
      expect(details.displayLocation).toBe('Cherthala, Kerala');
    });
  });
});
