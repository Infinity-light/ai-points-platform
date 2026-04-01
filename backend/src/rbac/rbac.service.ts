import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { ProjectMember } from '../project/entities/project-member.entity';
import {
  CreateRoleDto,
  UpdateRoleDto,
  SetPermissionsDto,
} from './dto/rbac.dto';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepo: Repository<ProjectMember>,
  ) {}

  async listRoles(tenantId: string, scope?: string): Promise<Role[]> {
    const qb = this.roleRepo
      .createQueryBuilder('role')
      .where('(role.tenantId = :tenantId OR role.tenantId IS NULL)', {
        tenantId,
      });

    if (scope) {
      qb.andWhere('role.scope = :scope', { scope });
    }

    return qb.orderBy('role.isSystem', 'DESC').addOrderBy('role.name', 'ASC').getMany();
  }

  async createRole(tenantId: string, dto: CreateRoleDto): Promise<Role> {
    const existing = await this.roleRepo.findOne({
      where: { tenantId, name: dto.name, scope: dto.scope },
    });

    if (existing) {
      throw new ConflictException(`角色名称 "${dto.name}" 已存在`);
    }

    const role = this.roleRepo.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      scope: dto.scope,
      isSystem: false,
    });

    return this.roleRepo.save(role);
  }

  async updateRole(roleId: string, tenantId: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findRoleInTenant(roleId, tenantId);

    if (dto.name !== undefined) {
      role.name = dto.name;
    }
    if (dto.description !== undefined) {
      role.description = dto.description;
    }

    return this.roleRepo.save(role);
  }

  async deleteRole(roleId: string, tenantId: string): Promise<void> {
    const role = await this.findRoleInTenant(roleId, tenantId);

    if (role.isSystem) {
      throw new BadRequestException('系统内置角色不可删除');
    }

    await this.roleRepo.remove(role);
  }

  async getPermissions(roleId: string, tenantId: string): Promise<RolePermission[]> {
    await this.findRoleInTenant(roleId, tenantId);
    return this.rolePermissionRepo.find({ where: { roleId } });
  }

  async setPermissions(
    roleId: string,
    tenantId: string,
    dto: SetPermissionsDto,
  ): Promise<RolePermission[]> {
    await this.findRoleInTenant(roleId, tenantId);

    // 删除现有权限，重新插入
    await this.rolePermissionRepo.delete({ roleId });

    if (dto.permissions.length === 0) {
      return [];
    }

    const entities = dto.permissions.map((p) =>
      this.rolePermissionRepo.create({
        roleId,
        resource: p.resource,
        action: p.action,
      }),
    );

    return this.rolePermissionRepo.save(entities);
  }

  async assignTenantRole(
    userId: string,
    roleId: string,
    tenantId: string,
  ): Promise<UserRole> {
    const role = await this.findRoleInTenant(roleId, tenantId);

    if (role.scope !== 'tenant') {
      throw new BadRequestException('只能分配租户级角色给用户');
    }

    const existing = await this.userRoleRepo.findOne({ where: { userId } });

    if (existing) {
      existing.roleId = roleId;
      return this.userRoleRepo.save(existing);
    }

    const userRole = this.userRoleRepo.create({ userId, roleId });
    return this.userRoleRepo.save(userRole);
  }

  async assignProjectRole(
    userId: string,
    projectId: string,
    roleId: string,
    tenantId: string,
  ): Promise<ProjectMember> {
    const role = await this.findRoleInTenant(roleId, tenantId);

    if (role.scope !== 'project') {
      throw new BadRequestException('只能分配项目级角色给项目成员');
    }

    const member = await this.projectMemberRepo.findOne({
      where: { userId, projectId, tenantId },
    });

    if (!member) {
      throw new NotFoundException('用户不是该项目成员');
    }

    member.projectRoleId = roleId;
    return this.projectMemberRepo.save(member);
  }

  async getUserPermissions(
    userId: string,
    tenantId: string,
  ): Promise<Array<{ resource: string; action: string }>> {
    const userRole = await this.userRoleRepo.findOne({ where: { userId } });

    if (!userRole) {
      return [];
    }

    const permissions = await this.rolePermissionRepo.find({
      where: { roleId: userRole.roleId },
    });

    return permissions.map((p) => ({ resource: p.resource, action: p.action }));
  }

  private async findRoleInTenant(roleId: string, tenantId: string): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: [
        { id: roleId, tenantId },
        { id: roleId, tenantId: undefined },
      ],
    });

    if (!role) {
      throw new NotFoundException(`角色 ${roleId} 不存在`);
    }

    // 系统角色（tenantId 为 null）对所有租户可见
    if (role.tenantId !== null && role.tenantId !== tenantId) {
      throw new NotFoundException(`角色 ${roleId} 不存在`);
    }

    return role;
  }
}
