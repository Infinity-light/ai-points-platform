import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { UserRole } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { ProjectMember } from '../project/entities/project-member.entity';

// 资源类型（字符串）
export type AppResource =
  | 'users'
  | 'roles'
  | 'projects'
  | 'tasks'
  | 'points'
  | 'votes'
  | 'settlements'
  | 'dividends'
  | 'tenants'
  | 'config'
  | 'audit'
  | 'bulletin'
  | 'auctions'
  | 'feishu'
  | 'all';

// 动作类型（字符串）
export type AppAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'trigger'
  | 'close'
  | 'manage';

// Subject 类型（字符串作为 subject）
type Subjects = InferSubjects<AppResource> | 'all';

export type AppAbility = MongoAbility<[AppAction, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepo: Repository<ProjectMember>,
  ) {}

  async createForUser(userId: string, tenantId: string): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    try {
      const userRole = await this.userRoleRepo.findOne({
        where: { userId },
        relations: ['role'],
      });

      if (userRole) {
        const permissions = await this.rolePermissionRepo.find({
          where: { roleId: userRole.roleId },
        });

        for (const perm of permissions) {
          can(perm.action as AppAction, perm.resource as AppResource);
        }
      }
    } catch {
      // 权限加载失败时返回空权限（最小权限原则）
    }

    return build({
      detectSubjectType: (subject) =>
        subject as unknown as ExtractSubjectType<Subjects>,
    });
  }

  async createForProject(
    userId: string,
    projectId: string,
    tenantId: string,
  ): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    try {
      const member = await this.projectMemberRepo.findOne({
        where: { userId, projectId, tenantId },
      });

      if (member) {
        const permissions = await this.rolePermissionRepo.find({
          where: { roleId: member.projectRoleId },
        });

        for (const perm of permissions) {
          can(perm.action as AppAction, perm.resource as AppResource);
        }
      }
    } catch {
      // 权限加载失败时返回空权限
    }

    return build({
      detectSubjectType: (subject) =>
        subject as unknown as ExtractSubjectType<Subjects>,
    });
  }
}
