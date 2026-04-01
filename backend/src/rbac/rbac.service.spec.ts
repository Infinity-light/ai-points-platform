import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { ProjectMember } from '../project/entities/project-member.entity';

const mockRole = (overrides: Partial<Role> = {}): Role =>
  ({
    id: 'role-uuid-1',
    tenantId: 'tenant-uuid-1',
    name: 'custom_role',
    description: 'A custom role',
    scope: 'tenant',
    isSystem: false,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Role;

const mockPermission = (overrides: Partial<RolePermission> = {}): RolePermission =>
  ({
    id: 'perm-uuid-1',
    roleId: 'role-uuid-1',
    resource: 'tasks',
    action: 'read',
    ...overrides,
  }) as RolePermission;

const mockUserRole = (): UserRole =>
  ({
    id: 'ur-uuid-1',
    userId: 'user-uuid-1',
    roleId: 'role-uuid-1',
    role: mockRole(),
  }) as UserRole;

describe('RbacService', () => {
  let service: RbacService;
  let roleRepo: jest.Mocked<{
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  }>;
  let rolePermissionRepo: jest.Mocked<{
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  }>;
  let userRoleRepo: jest.Mocked<{
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  }>;
  let projectMemberRepo: jest.Mocked<{
    findOne: jest.Mock;
    save: jest.Mock;
  }>;

  beforeEach(async () => {
    roleRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    rolePermissionRepo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    userRoleRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    projectMemberRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(RolePermission), useValue: rolePermissionRepo },
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepo },
        { provide: getRepositoryToken(ProjectMember), useValue: projectMemberRepo },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  describe('createRole', () => {
    it('应该创建新角色', async () => {
      const role = mockRole();
      roleRepo.findOne.mockResolvedValue(null);
      roleRepo.create.mockReturnValue(role);
      roleRepo.save.mockResolvedValue(role);

      const result = await service.createRole('tenant-uuid-1', {
        name: 'custom_role',
        description: 'A custom role',
        scope: 'tenant',
      });

      expect(result).toEqual(role);
      expect(roleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-uuid-1',
          name: 'custom_role',
          isSystem: false,
        }),
      );
    });

    it('应该在角色名称重复时抛出 ConflictException', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole());

      await expect(
        service.createRole('tenant-uuid-1', {
          name: 'custom_role',
          scope: 'tenant',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteRole', () => {
    it('应该删除非系统角色', async () => {
      const role = mockRole({ isSystem: false });
      roleRepo.findOne.mockResolvedValue(role);
      roleRepo.remove.mockResolvedValue(undefined);

      await service.deleteRole('role-uuid-1', 'tenant-uuid-1');

      expect(roleRepo.remove).toHaveBeenCalledWith(role);
    });

    it('应该拒绝删除系统角色', async () => {
      const role = mockRole({ isSystem: true });
      roleRepo.findOne.mockResolvedValue(role);

      await expect(
        service.deleteRole('role-uuid-1', 'tenant-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('应该在角色不存在时抛出 NotFoundException', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteRole('bad-uuid', 'tenant-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPermissions', () => {
    it('应该替换角色的所有权限', async () => {
      const role = mockRole();
      const perms = [mockPermission()];

      roleRepo.findOne.mockResolvedValue(role);
      rolePermissionRepo.delete.mockResolvedValue(undefined);
      rolePermissionRepo.create.mockImplementation((p) => ({ ...p } as RolePermission));
      rolePermissionRepo.save.mockResolvedValue(perms);

      const result = await service.setPermissions('role-uuid-1', 'tenant-uuid-1', {
        permissions: [{ resource: 'tasks', action: 'read' }],
      });

      expect(rolePermissionRepo.delete).toHaveBeenCalledWith({ roleId: 'role-uuid-1' });
      expect(result).toEqual(perms);
    });

    it('应该在权限列表为空时清除所有权限', async () => {
      const role = mockRole();
      roleRepo.findOne.mockResolvedValue(role);
      rolePermissionRepo.delete.mockResolvedValue(undefined);

      const result = await service.setPermissions('role-uuid-1', 'tenant-uuid-1', {
        permissions: [],
      });

      expect(result).toEqual([]);
    });
  });

  describe('assignTenantRole', () => {
    it('应该为用户分配租户级角色', async () => {
      const role = mockRole({ scope: 'tenant' });
      const ur = mockUserRole();

      roleRepo.findOne.mockResolvedValue(role);
      userRoleRepo.findOne.mockResolvedValue(null);
      userRoleRepo.create.mockReturnValue(ur);
      userRoleRepo.save.mockResolvedValue(ur);

      const result = await service.assignTenantRole('user-uuid-1', 'role-uuid-1', 'tenant-uuid-1');

      expect(result).toEqual(ur);
    });

    it('应该拒绝分配项目级角色作为租户角色', async () => {
      const role = mockRole({ scope: 'project' });
      roleRepo.findOne.mockResolvedValue(role);

      await expect(
        service.assignTenantRole('user-uuid-1', 'role-uuid-1', 'tenant-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserPermissions', () => {
    it('应该返回用户的权限列表', async () => {
      const ur = mockUserRole();
      const perms = [mockPermission()];

      userRoleRepo.findOne.mockResolvedValue(ur);
      rolePermissionRepo.find.mockResolvedValue(perms);

      const result = await service.getUserPermissions('user-uuid-1', 'tenant-uuid-1');

      expect(result).toEqual([{ resource: 'tasks', action: 'read' }]);
    });

    it('应该在用户无角色时返回空数组', async () => {
      userRoleRepo.findOne.mockResolvedValue(null);

      const result = await service.getUserPermissions('user-uuid-1', 'tenant-uuid-1');

      expect(result).toEqual([]);
    });
  });
});
