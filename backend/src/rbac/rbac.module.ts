import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { ProjectMember } from '../project/entities/project-member.entity';
import { CaslAbilityFactory } from './casl-ability.factory';
import { PoliciesGuard } from './policies.guard';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, RolePermission, UserRole, ProjectMember]),
  ],
  controllers: [RbacController],
  providers: [CaslAbilityFactory, RbacService, PoliciesGuard],
  exports: [CaslAbilityFactory, RbacService, PoliciesGuard],
})
export class RbacModule {}
