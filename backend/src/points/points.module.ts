import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import { PointRecord } from './entities/point-record.entity';
import { PointsSnapshot } from './entities/points-snapshot.entity';
import { Project } from '../project/entities/project.entity';
import { User } from '../user/entities/user.entity';
import { ProjectModule } from '../project/project.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PointRecord, PointsSnapshot, Project, User]),
    ProjectModule,
    RbacModule,
  ],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
