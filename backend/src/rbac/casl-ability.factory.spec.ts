import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CaslAbilityFactory } from './casl-ability.factory';
import { UserRole } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { ProjectMember } from '../project/entities/project-member.entity';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;
  let userRoleRepo: { findOne: jest.Mock };
  let rolePermissionRepo: { find: jest.Mock };
  let projectMemberRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    userRoleRepo = { findOne: jest.fn() };
    rolePermissionRepo = { find: jest.fn() };
    projectMemberRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaslAbilityFactory,
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepo },
        { provide: getRepositoryToken(RolePermission), useValue: rolePermissionRepo },
        { provide: getRepositoryToken(ProjectMember), useValue: projectMemberRepo },
      ],
    }).compile();

    factory = module.get<CaslAbilityFactory>(CaslAbilityFactory);
  });

  describe('createForUser', () => {
    it('应该基于用户角色权限构建 Ability', async () => {
      userRoleRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        roleId: 'role-1',
        role: { id: 'role-1', name: 'employee' },
      });
      rolePermissionRepo.find.mockResolvedValue([
        { roleId: 'role-1', resource: 'tasks', action: 'read' },
        { roleId: 'role-1', resource: 'points', action: 'read' },
      ]);

      const ability = await factory.createForUser('user-1', 'tenant-1');

      expect(ability.can('read', 'tasks')).toBe(true);
      expect(ability.can('read', 'points')).toBe(true);
      expect(ability.can('delete', 'tasks')).toBe(false);
    });

    it('应该在用户无角色时返回空权限', async () => {
      userRoleRepo.findOne.mockResolvedValue(null);

      const ability = await factory.createForUser('user-1', 'tenant-1');

      expect(ability.can('read', 'tasks')).toBe(false);
    });

    it('应该在权限加载失败时返回空权限（最小权限原则）', async () => {
      userRoleRepo.findOne.mockRejectedValue(new Error('DB error'));

      const ability = await factory.createForUser('user-1', 'tenant-1');

      expect(ability.can('read', 'tasks')).toBe(false);
    });
  });

  describe('createForProject', () => {
    it('应该基于项目角色构建 Ability', async () => {
      projectMemberRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        projectId: 'project-1',
        projectRoleId: 'role-6',
      });
      rolePermissionRepo.find.mockResolvedValue([
        { roleId: 'role-6', resource: 'tasks', action: 'read' },
        { roleId: 'role-6', resource: 'votes', action: 'create' },
      ]);

      const ability = await factory.createForProject('user-1', 'project-1', 'tenant-1');

      expect(ability.can('read', 'tasks')).toBe(true);
      expect(ability.can('create', 'votes')).toBe(true);
      expect(ability.can('delete', 'tasks')).toBe(false);
    });

    it('应该在用户不是项目成员时返回空权限', async () => {
      projectMemberRepo.findOne.mockResolvedValue(null);

      const ability = await factory.createForProject('user-1', 'project-1', 'tenant-1');

      expect(ability.can('read', 'tasks')).toBe(false);
    });
  });
});
