import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReverseGeocodeDto {
  @ApiProperty({
    description: 'Latitude coordinate of the location (-90 to 90)',
    example: 9.164392,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Latitude must be a valid number' })
  @IsNotEmpty({ message: 'Latitude is required' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate of the location (-180 to 180)',
    example: 76.667187,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Longitude must be a valid number' })
  @IsNotEmpty({ message: 'Longitude is required' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude: number;
}
