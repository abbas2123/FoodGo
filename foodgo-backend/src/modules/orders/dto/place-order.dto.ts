import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlaceOrderItemDto {
  @ApiProperty({ description: 'Menu item ID' })
  @IsInt()
  @IsPositive()
  menuItemId: number;

  @ApiProperty({ description: 'Quantity', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class PlaceOrderDto {
  @ApiProperty({ description: 'Restaurant ID' })
  @IsInt()
  @IsPositive()
  restaurantId: number;

  @ApiProperty({ type: [PlaceOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => PlaceOrderItemDto)
  items: PlaceOrderItemDto[];

  @ApiPropertyOptional({ description: 'Delivery address ID' })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ description: 'Delivery address ID alternative' })
  @IsOptional()
  deliveryAddressId?: string | number;

  @ApiPropertyOptional({ description: 'Special instructions for the order' })
  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @ApiPropertyOptional({ description: 'Payment method used (e.g. CARD, CASH, UPI)' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Formatted delivery address text' })
  @IsOptional()
  @IsString()
  deliveryAddressText?: string;
}

