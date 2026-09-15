import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdressService } from './adress.service.js';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';

function getUserId(req: any): bigint {
  const rawId = req.user?.userId ?? req.user?.sub;
  if (!rawId) {
    throw new UnauthorizedException('User not authenticated');
  }
  return BigInt(rawId);
}

function parseAddressId(id: string): bigint {
  try {
    return BigInt(id);
  } catch {
    throw new BadRequestException('Invalid address ID format');
  }
}

@ApiTags('Address')
@ApiBearerAuth()
@Controller('Address')
@UseGuards(JwtAuthGuard)
export class AdressController {
  constructor(private readonly addressService: AdressService) {}

  @Get()
  @ApiOperation({ summary: 'Get all saved addresses for the authenticated user' })
  @ApiOkResponse({ description: 'Addresses retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getUserAddress(@Req() req: any) {
    const userId = getUserId(req);
    return this.addressService.getAddresses(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new address for the authenticated user' })
  @ApiCreatedResponse({ description: 'Address created successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async createAddress(@Req() req: any, @Body() dto: CreateAddressDto) {
    const userId = getUserId(req);
    return this.addressService.createAddress(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing address belonging to the user' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiOkResponse({ description: 'Address updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async updateAddress(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const userId = getUserId(req);
    const addressId = parseAddressId(id);
    return this.addressService.updateAddress(userId, addressId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an address belonging to the user' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiOkResponse({ description: 'Address deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async deleteAddress(@Req() req: any, @Param('id') id: string) {
    const userId = getUserId(req);
    const addressId = parseAddressId(id);
    return this.addressService.deleteAddress(userId, addressId);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set a saved address as the default delivery address' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiOkResponse({ description: 'Default address updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async setDefaultAddress(@Req() req: any, @Param('id') id: string) {
    const userId = getUserId(req);
    const addressId = parseAddressId(id);
    return this.addressService.setDefaultAddress(userId, addressId);
  }
}
