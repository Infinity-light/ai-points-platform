import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ToggleInviteDto } from './dto/toggle-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../user/guards/roles.guard';
import { Roles } from '../user/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';
import { CurrentTenant } from '../tenant/decorators/tenant.decorator';
import { PointsService } from '../points/points.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsOptional, IsString } from 'class-validator';

class RejectBatchDto {
  @IsOptional()
  @IsString()
  note?: string;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly pointsService: PointsService,
  ) {}

  @Get('users')
  listUsers(@CurrentTenant() tenantId: string) {
    return this.adminService.listUsers(tenantId);
  }

  @Patch('users/:id/role')
  updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.adminService.updateUserRole(id, tenantId, dto.role);
  }

  @Get('stats')
  getTenantStats(@CurrentTenant() tenantId: string) {
    return this.adminService.getTenantStats(tenantId);
  }

  @Get('invites')
  listInviteCodes(@CurrentTenant() tenantId: string) {
    return this.adminService.listInviteCodes(tenantId);
  }

  @Patch('invites/:id/toggle')
  toggleInviteCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: ToggleInviteDto,
  ) {
    return this.adminService.toggleInviteCode(id, tenantId, dto.isActive);
  }

  // T07: Approval batch management
  @Get('approval-batches')
  listApprovalBatches(@CurrentTenant() tenantId: string) {
    return this.pointsService.listPendingBatches(tenantId);
  }

  @Get('approval-batches/:id')
  getApprovalBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pointsService.getApprovalBatch(id, tenantId);
  }

  @Patch('approval-batches/:id/approve')
  approveApprovalBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.pointsService.approveBatch(id, tenantId, req.user.sub);
  }

  @Patch('approval-batches/:id/reject')
  rejectApprovalBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Body() dto: RejectBatchDto,
  ) {
    return this.pointsService.rejectBatch(id, tenantId, req.user.sub, dto.note);
  }
}
