import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateDriverLocationDto {
  @ApiProperty({
    description: 'Latitude of the driver (-90 to 90)',
    example: 12.9716,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Longitude of the driver (-180 to 180)',
    example: 77.5946,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Driver movement heading/bearing in degrees (0 to 360)',
    example: 90,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({
    description: 'ISO 8601 timestamp of when GPS coordinate was captured',
    example: '2026-10-11T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  timestamp?: string;
}
