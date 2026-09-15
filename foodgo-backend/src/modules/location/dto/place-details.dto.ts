import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlaceDetailsDto {
  @ApiProperty({
    description: 'Google Maps place ID',
    example: 'ChIJbU60qSXbBDkRxljMfK2h6AQ',
  })
  @IsString({ message: 'placeId must be a string' })
  @IsNotEmpty({ message: 'placeId is required' })
  placeId: string;
}
