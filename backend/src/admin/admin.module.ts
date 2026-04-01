import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../user/entities/user.entity';
import { PointRecord } from '../points/entities/point-record.entity';
import { Invite } from '../invite/entities/invite.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { ProjectMember } from '../project/entities/project-member.entity';
import { Project } from '../project/entities/project.entity';
import { UserModule } from '../user/user.module';
import { PointsModule } from '../points/points.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PointRecord, Invite, UserRole, ProjectMember, Project]),
    UserModule,
    PointsModule,
    RbacModule,
    TenantModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
