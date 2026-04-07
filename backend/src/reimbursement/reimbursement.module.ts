import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reimbursement } from './entities/reimbursement.entity';
import { ReimbursementItem } from './entities/reimbursement-item.entity';
import { ReimbursementService } from './reimbursement.service';
import { ReimbursementController } from './reimbursement.controller';
import { RbacModule } from '../rbac/rbac.module';
import { ApprovalModule } from '../approval/approval.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reimbursement, ReimbursementItem]),
    RbacModule,
    forwardRef(() => ApprovalModule),
  ],
  controllers: [ReimbursementController],
  providers: [ReimbursementService],
  exports: [ReimbursementService],
})
export class ReimbursementModule {}
