import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('notifications')
// Auth handled by global CompositeAuthGuard
export class NotificationController {
  constructor(private readonly notifService: NotificationService) {}

  @Get()
  list(@Request() req: RequestWithUser) {
    return this.notifService.findByUser(req.user.sub, req.user.tenantId);
  }

  @Get('unread-count')
  async unreadCount(@Request() req: RequestWithUser) {
    const count = await this.notifService.getUnreadCount(req.user.sub, req.user.tenantId);
    return { count };
  }

  @Patch('read-all')
  async markAllRead(@Request() req: RequestWithUser) {
    await this.notifService.markAllAsRead(req.user.sub, req.user.tenantId);
    return { success: true };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Request() req: RequestWithUser) {
    await this.notifService.markAsRead(id, req.user.sub);
    return { success: true };
  }
}
