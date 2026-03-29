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
import { RolesGuard } from '../user/guards/roles.guard';
import { Roles } from '../user/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';
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
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('my-summary')
  getMySummary(@Request() req: RequestWithUser) {
    return this.pointsService.getMySummary(req.user.tenantId, req.user.sub);
  }

  // T08: Profile — personal detail across all projects
  @Get('my-projects')
  getMyProjects(@Request() req: RequestWithUser) {
    return this.pointsService.getMyProjectsDetail(req.user.tenantId, req.user.sub);
  }

  // T04: Team points table for a project
  @Get('project/:projectId/points-table')
  getProjectPointsTable(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.pointsService.getProjectPointsTable(req.user.tenantId, projectId);
  }

  // T07: Create approval batch (project_lead+)
  @Post('approval-batch')
  @UseGuards(RolesGuard)
  @Roles(Role.PROJECT_LEAD, Role.HR_ADMIN, Role.SUPER_ADMIN)
  createApprovalBatch(
    @Body() dto: CreateApprovalBatchDto,
    @Request() req: RequestWithUser,
  ) {
    return this.pointsService.createApprovalBatch(req.user.tenantId, dto.projectId, req.user.sub);
  }
}
