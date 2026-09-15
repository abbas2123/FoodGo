import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: '+14155552671',
    description: 'User mobile phone number in E.164 or national format',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{5,14}$/, {
    message: 'phone must be a valid phone number (6 to 15 digits)',
  })
  phone: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit verification code received via SMS',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only numbers' })
  otp: string;
}
