import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMethodType } from '../../../generated/prisma/client.js';

export class CreatePaymentMethodDto {
  @ApiProperty({
    enum: PaymentMethodType,
    description: 'Type of payment method',
    example: PaymentMethodType.CARD,
  })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiProperty({
    description: 'Safe masked identifier for the payment method (e.g. •••• 4242 or user@upi)',
    example: '•••• 4242',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  maskedIdentifier: string;

  @ApiPropertyOptional({
    description: 'Payment provider name (e.g. STRIPE, RAZORPAY, MANUAL)',
    example: 'MANUAL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @ApiPropertyOptional({
    description: 'Whether to set as the default payment method',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
