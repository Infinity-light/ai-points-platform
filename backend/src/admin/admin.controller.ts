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
import { ToggleInviteDto } from './dto/toggle-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { CurrentTenant } from '../tenant/decorators/tenant.decorator';
import { PointsService } from '../points/points.service';
import { TenantService } from '../tenant/tenant.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';

class RejectBatchDto {
  @IsOptional()
  @IsString()
  note?: string;
}

class UpdateUserRoleDto {
  @IsUUID()
  roleId!: string;
}

class UpdateTenantSettingsDto {
  @IsBoolean()
  @IsOptional()
  bulletinPublic?: boolean;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@CheckPolicies('users', 'read')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly pointsService: PointsService,
    private readonly tenantService: TenantService,
  ) {}

  @Get('users')
  listUsers(@CurrentTenant() tenantId: string) {
    return this.adminService.listUsers(tenantId);
  }

  @Patch('users/:id/role')
  @CheckPolicies('users', 'update')
  updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, tenantId, dto.roleId);
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
  @CheckPolicies('users', 'update')
  toggleInviteCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: ToggleInviteDto,
  ) {
    return this.adminService.toggleInviteCode(id, tenantId, dto.isActive);
  }

  @Get('users/:id/projects')
  getUserProjects(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.adminService.getUserProjects(id, tenantId);
  }

  @Get('tenant-settings')
  getTenantSettings(@CurrentTenant() tenantId: string) {
    return this.tenantService.findOne(tenantId).then((t) => ({ settings: t.settings ?? {} }));
  }

  @Patch('tenant-settings')
  @CheckPolicies('config', 'update')
  async updateTenantSettings(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    const tenant = await this.tenantService.findOne(tenantId);
    const merged = { ...(tenant.settings ?? {}), ...dto };
    // Pass as unknown to bypass strict UpdateTenantDto typing
    await this.tenantService.update(tenantId, { settings: merged } as unknown as Parameters<typeof this.tenantService.update>[1]);
    return { settings: merged };
  }

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
  @CheckPolicies('points', 'approve')
  approveApprovalBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.pointsService.approveBatch(id, tenantId, req.user.sub);
  }

  @Patch('approval-batches/:id/reject')
  @CheckPolicies('points', 'approve')
  rejectApprovalBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Request() req: RequestWithUser,
    @Body() dto: RejectBatchDto,
  ) {
    return this.pointsService.rejectBatch(id, tenantId, req.user.sub, dto.note);
  }
}
