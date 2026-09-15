import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({
    description: 'Address label (e.g. Home, Work, Other)',
    example: 'Home',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @ApiProperty({
    description: 'Primary street address line',
    example: '123 Main Street',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address_line1: string;

  @ApiPropertyOptional({
    description: 'Secondary address line (Apartment, suite, unit, etc.)',
    example: 'Apt 4B, Green Towers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional({
    description: 'Nearby landmark for easier delivery identification',
    example: 'Near Metro Station Gate 2',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  landmark?: string;

  @ApiProperty({
    description: 'City name',
    example: 'Kochi',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiProperty({
    description: 'State / Province name',
    example: 'Kerala',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state: string;

  @ApiProperty({
    description: 'Postal code / PIN code',
    example: '682001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postal_code: string;

  @ApiPropertyOptional({
    description: 'Country name',
    default: 'India',
    example: 'India',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({
    description: 'GPS latitude coordinate',
    example: 9.9312,
  })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({
    description: 'GPS longitude coordinate',
    example: 76.2673,
  })
  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({
    description: 'Whether to set as default delivery address',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
