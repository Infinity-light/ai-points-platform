import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { PointsService } from './points.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('points')
@UseGuards(PoliciesGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('my-summary')
  @CheckPolicies('points', 'read')
  getMySummary(@Request() req: RequestWithUser) {
    return this.pointsService.getMySummary(req.user.tenantId, req.user.sub);
  }

  @Get('my-projects')
  @CheckPolicies('points', 'read')
  getMyProjects(@Request() req: RequestWithUser) {
    return this.pointsService.getMyProjectsDetail(req.user.tenantId, req.user.sub);
  }

  @Get('project/:projectId/points-table')
  @CheckPolicies('points', 'read')
  getProjectPointsTable(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.pointsService.getProjectPointsTable(req.user.tenantId, projectId);
  }

}
