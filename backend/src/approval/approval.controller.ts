import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApprovalService } from './approval.service';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { ApprovalAction } from './entities/approval-record.entity';
import type { ApprovalConfigType } from './entities/approval-config.entity';

class UpsertConfigBodyDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['reimbursement', 'asset_operation'])
  configType!: ApprovalConfigType;

  @IsString()
  @IsOptional()
  @IsIn(['department_head', 'manual'])
  deptApproverMode?: 'department_head' | 'manual';

  @IsUUID()
  @IsOptional()
  financePersonId?: string | null;

  @IsUUID()
  @IsOptional()
  finalApproverId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class ApproveBodyDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['approved', 'rejected', 'returned'])
  action!: ApprovalAction;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('approval')
@UseGuards(PoliciesGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get('configs')
  @CheckPolicies('approvals', 'read')
  getConfigs(@Request() req: RequestWithUser) {
    return this.approvalService.getAllConfigs(req.user.tenantId);
  }

  @Post('configs')
  @CheckPolicies('approvals', 'manage')
  upsertConfig(@Request() req: RequestWithUser, @Body() dto: UpsertConfigBodyDto) {
    return this.approvalService.upsertConfig(req.user.tenantId, {
      configType: dto.configType,
      deptApproverMode: dto.deptApproverMode,
      financePersonId: dto.financePersonId,
      finalApproverId: dto.finalApproverId,
      isActive: dto.isActive,
    });
  }

  @Get('instances/pending')
  @CheckPolicies('approvals', 'read')
  getPending(@Request() req: RequestWithUser) {
    return this.approvalService.getPendingForUser(req.user.sub, req.user.tenantId);
  }

  @Get('instances/:id')
  @CheckPolicies('approvals', 'read')
  getInstance(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.approvalService.getInstance(id, req.user.tenantId);
  }

  @Post('instances/:id/approve')
  @CheckPolicies('approvals', 'approve')
  approve(@Request() req: RequestWithUser, @Param('id') id: string, @Body() dto: ApproveBodyDto) {
    return this.approvalService.approve(id, req.user.sub, req.user.tenantId, {
      action: dto.action,
      comment: dto.comment,
    });
  }
}
