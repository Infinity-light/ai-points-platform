import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { PointsService } from './points.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsUUID, IsNotEmpty } from 'class-validator';

class CreateApprovalBatchDto {
  @IsUUID()
  @IsNotEmpty()
  projectId!: string;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('points')
@UseGuards(JwtAuthGuard, PoliciesGuard)
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

  @Post('approval-batch')
  @CheckPolicies('points', 'approve')
  createApprovalBatch(
    @Body() dto: CreateApprovalBatchDto,
    @Request() req: RequestWithUser,
  ) {
    return this.pointsService.createApprovalBatch(req.user.tenantId, dto.projectId, req.user.sub);
  }
}
