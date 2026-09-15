import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationController } from './location.controller.js';
import { LocationService, ReverseGeocodeResponse } from './location.service.js';

describe('LocationController', () => {
  let controller: LocationController;
  let service: LocationService;

  beforeEach(() => {
    service = {
      reverseGeocode: vi.fn(),
    } as unknown as LocationService;

    controller = new LocationController(service);
  });

  it('delegates to locationService.reverseGeocode with dto coordinates', async () => {
    const mockResponse: ReverseGeocodeResponse = {
      latitude: 9.164392,
      longitude: 76.667187,
      locality: 'Athikkattukulangara',
      city: 'Mavelikkara',
      district: 'Alappuzha',
      state: 'Kerala',
      country: 'India',
      postalCode: '690504',
      formattedAddress: 'Athikkattukulangara, Kerala 690504, India',
      displayLocation: 'Athikkattukulangara, Kerala',
    };

    vi.spyOn(service, 'reverseGeocode').mockResolvedValue(mockResponse);

    const result = await controller.reverseGeocode({
      latitude: 9.164392,
      longitude: 76.667187,
    });

    expect(service.reverseGeocode).toHaveBeenCalledWith(9.164392, 76.667187);
    expect(result).toEqual(mockResponse);
  });
});
