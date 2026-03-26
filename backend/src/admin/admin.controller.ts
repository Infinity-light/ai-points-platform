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
import { UpdateRoleDto } from './dto/update-role.dto';
import { ToggleInviteDto } from './dto/toggle-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../user/guards/roles.guard';
import { Roles } from '../user/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';
import { CurrentTenant } from '../tenant/decorators/tenant.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
}
