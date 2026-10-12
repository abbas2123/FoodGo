import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyEmailOtpDto {
  @ApiProperty({
    description: 'User email address for verification',
    example: 'customer@example.com',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  email: string;

  @ApiProperty({
    description: '6-digit OTP code received via email',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'otp must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'otp must contain digits only' })
  otp: string;
}
