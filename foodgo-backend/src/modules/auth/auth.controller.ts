import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { SendOtpDto } from './dto/send-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('phone/send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send verification OTP to user phone number' })
  @ApiOkResponse({
    description: 'OTP generated and sent to phone successfully',
    schema: {
      example: {
        success: true,
        message: 'OTP sent successfully',
        data: null,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid phone number or cooldown active' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Public()
  @Post('phone/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code and authenticate/register user' })
  @ApiOkResponse({
    description: 'OTP verified, user authenticated, and tokens issued',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.otp);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate and refresh access & refresh tokens' })
  @ApiOkResponse({
    description: 'New access and refresh token pair generated',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out user by revoking the refresh token' })
  @ApiOkResponse({
    description: 'Refresh token revoked successfully',
    schema: {
      example: {
        success: true,
        message: 'Logged out successfully',
        data: null,
      },
    },
  })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
