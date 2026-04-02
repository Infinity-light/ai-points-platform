import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { CurrentTenant } from '../tenant/decorators/tenant.decorator';
import { TenantService } from '../tenant/tenant.service';
import { Matches, IsBoolean, IsOptional } from 'class-validator';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class UpdateUserRoleDto {
  @Matches(UUID_PATTERN, { message: 'roleId must be a valid UUID' })
  roleId!: string;
}

class UpdateTenantSettingsDto {
  @IsBoolean()
  @IsOptional()
  bulletinPublic?: boolean;
}

@Controller('admin')
@UseGuards(PoliciesGuard)
@CheckPolicies('users', 'read')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
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

}
