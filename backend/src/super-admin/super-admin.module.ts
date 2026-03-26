import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { TenantModule } from '../tenant/tenant.module';
import { User } from '../user/entities/user.entity';
import { Task } from '../task/entities/task.entity';
import { Submission } from '../submission/entities/submission.entity';

@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forFeature([User, Task, Submission]),
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}
