import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

function getUserId(req: any): bigint {
  const rawId = req.user?.userId ?? req.user?.sub;
  if (!rawId) throw new UnauthorizedException('User not authenticated');
  return BigInt(rawId);
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for authenticated user' })
  @ApiOkResponse({ description: 'Notifications retrieved successfully' })
  getNotifications(@Req() req: any) {
    const userId = getUserId(req);
    return this.notificationsService.getNotifications(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiOkResponse({ description: 'Notification marked as read' })
  markAsRead(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = getUserId(req);
    return this.notificationsService.markAsRead(userId, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ description: 'All notifications marked as read' })
  markAllAsRead(@Req() req: any) {
    const userId = getUserId(req);
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiOkResponse({ description: 'Notification deleted successfully' })
  deleteNotification(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = getUserId(req);
    return this.notificationsService.deleteNotification(userId, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear all notifications' })
  @ApiOkResponse({ description: 'All notifications cleared' })
  clearAll(@Req() req: any) {
    const userId = getUserId(req);
    return this.notificationsService.clearAll(userId);
  }
}
