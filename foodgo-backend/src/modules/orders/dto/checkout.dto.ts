import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckoutOrderItemDto {
  @ApiProperty({ description: 'Menu item ID' })
  @IsInt()
  @IsPositive()
  menuItemId: number;

  @ApiProperty({ description: 'Quantity', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CheckoutRestaurantOrderDto {
  @ApiProperty({ description: 'Restaurant ID' })
  @IsInt()
  @IsPositive()
  restaurantId: number;

  @ApiProperty({ type: [CheckoutOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CheckoutOrderItemDto)
  items: CheckoutOrderItemDto[];

  @ApiPropertyOptional({ description: 'Special instructions for this restaurant order' })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

export class CheckoutDto {
  @ApiPropertyOptional({
    description: 'List of restaurant orders. If omitted, orders will be created from user server cart.',
    type: [CheckoutRestaurantOrderDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutRestaurantOrderDto)
  orders?: CheckoutRestaurantOrderDto[];

  @ApiPropertyOptional({ description: 'Delivery address ID' })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ description: 'Delivery address ID alternative' })
  @IsOptional()
  deliveryAddressId?: string | number;

  @ApiPropertyOptional({ description: 'Formatted delivery address text' })
  @IsOptional()
  @IsString()
  deliveryAddressText?: string;

  @ApiPropertyOptional({ description: 'Payment method used (e.g. COD, CARD, UPI, RAZORPAY)' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Special instructions for the entire checkout' })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}
