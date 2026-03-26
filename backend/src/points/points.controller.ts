import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PointsService } from './points.service';

interface RequestWithUser extends Request {
  user: { sub: string; tenantId: string };
}

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('my-summary')
  getMySummary(@Request() req: RequestWithUser) {
    return this.pointsService.getMySummary(req.user.tenantId, req.user.sub);
  }
}
