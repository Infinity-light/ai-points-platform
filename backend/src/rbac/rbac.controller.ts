import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { PoliciesGuard } from './policies.guard';
import { CheckPolicies } from './decorators/check-policies.decorator';
import { CurrentTenant } from '../tenant/decorators/tenant.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import {
  CreateRoleDto,
  UpdateRoleDto,
  SetPermissionsDto,
  AssignTenantRoleDto,
  AssignProjectRoleDto,
} from './dto/rbac.dto';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('rbac')
@UseGuards(PoliciesGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ─── 角色 CRUD ─────────────────────────────────────────────────

  @Get('roles')
  @CheckPolicies('roles', 'read')
  listRoles(
    @CurrentTenant() tenantId: string,
    @Query('scope') scope?: string,
  ) {
    return this.rbacService.listRoles(tenantId, scope);
  }

  @Post('roles')
  @CheckPolicies('roles', 'create')
  createRole(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rbacService.createRole(tenantId, dto);
  }

  @Patch('roles/:id')
  @CheckPolicies('roles', 'update')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbacService.updateRole(id, tenantId, dto);
  }

  @Delete('roles/:id')
  @CheckPolicies('roles', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    return this.rbacService.deleteRole(id, tenantId);
  }

  // ─── 权限管理 ──────────────────────────────────────────────────

  @Get('roles/:id/permissions')
  @CheckPolicies('roles', 'read')
  getPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.rbacService.getPermissions(id, tenantId);
  }

  @Put('roles/:id/permissions')
  @CheckPolicies('roles', 'update')
  setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: SetPermissionsDto,
  ) {
    return this.rbacService.setPermissions(id, tenantId, dto);
  }

  // ─── 角色分配 ──────────────────────────────────────────────────

  @Patch('users/:userId/tenant-role')
  @CheckPolicies('users', 'update')
  assignTenantRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: AssignTenantRoleDto,
  ) {
    return this.rbacService.assignTenantRole(userId, dto.roleId, tenantId);
  }

  @Patch('users/:userId/project-role')
  @CheckPolicies('users', 'update')
  assignProjectRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: AssignProjectRoleDto,
  ) {
    return this.rbacService.assignProjectRole(
      userId,
      dto.projectId,
      dto.roleId,
      tenantId,
    );
  }

  // ─── 我的权限 ──────────────────────────────────────────────────

  @Get('my-permissions')
  getMyPermissions(
    @Request() req: RequestWithUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.rbacService.getUserPermissions(req.user.sub, tenantId);
  }
}
