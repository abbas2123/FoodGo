import { Body, Controller, Delete, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Profile retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getProfile(@Req() req: any) {
    const userId = BigInt(req.user.sub ?? req.user.userId);
    return this.profileService.getProfile(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ description: 'Profile updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const userId = BigInt(req.user.sub ?? req.user.userId);
    return this.profileService.updateProfile(userId, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete user account, anonymize personal data, and revoke sessions' })
  @ApiOkResponse({
    description: 'Account successfully deleted and all sessions revoked',
    schema: {
      example: {
        success: true,
        message: 'Account deleted successfully. Personal data removed and active sessions revoked.',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async deleteAccount(@Req() req: any) {
    const userId = BigInt(req.user.sub ?? req.user.userId);
    return this.profileService.deleteAccount(userId);
  }
}
