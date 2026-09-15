import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LocationService } from './location.service.js';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto.js';
import { AutocompleteDto } from './dto/autocomplete.dto.js';
import { PlaceDetailsDto } from './dto/place-details.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Location')
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Public()
  @Get('reverse-geocode')
  @ApiOperation({
    summary: 'Reverse geocode coordinates into granular address details',
  })
  @ApiOkResponse({
    description:
      'Detailed address components and display location returned successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid coordinates provided' })
  async reverseGeocode(@Query() dto: ReverseGeocodeDto) {
    return this.locationService.reverseGeocode(dto.latitude, dto.longitude);
  }

  @Public()
  @Get('autocomplete')
  @ApiOperation({
    summary: 'Search place suggestions by text query like Swiggy',
  })
  @ApiOkResponse({
    description: 'List of matching place suggestions',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameter provided' })
  async autocomplete(@Query() dto: AutocompleteDto) {
    return this.locationService.autocomplete(dto.query);
  }

  @Public()
  @Get('place-details')
  @ApiOperation({
    summary: 'Get full address details and coordinates for a place ID',
  })
  @ApiOkResponse({
    description: 'Detailed address and coordinates returned successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid placeId parameter provided' })
  async getPlaceDetails(@Query() dto: PlaceDetailsDto) {
    return this.locationService.getPlaceDetails(dto.placeId);
  }
}
