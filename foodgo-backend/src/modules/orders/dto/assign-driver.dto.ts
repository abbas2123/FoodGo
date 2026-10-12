import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AssignDriverDto {
  @ApiProperty({
    description: 'Unique identifier of the assigned delivery partner or driver',
    example: 'drv_456',
  })
  @IsString()
  @IsNotEmpty()
  driverId: string;

  @ApiProperty({
    description: 'Full name of the delivery partner',
    example: 'Ramesh Kumar',
  })
  @IsString()
  @IsNotEmpty()
  driverName: string;

  @ApiPropertyOptional({
    description: 'Contact phone number of the driver',
    example: '+919876543210',
  })
  @IsOptional()
  @IsString()
  driverPhone?: string;

  @ApiPropertyOptional({
    description: 'Driver rating (1.0 to 5.0)',
    example: 4.8,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  driverRating?: number;

  @ApiPropertyOptional({
    description: 'Initial driver latitude',
    example: 12.9716,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  initialLat?: number;

  @ApiPropertyOptional({
    description: 'Initial driver longitude',
    example: 77.5946,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  initialLng?: number;

  @ApiPropertyOptional({
    description: 'Initial driver heading (0 to 360)',
    example: 180,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  initialHeading?: number;
}
