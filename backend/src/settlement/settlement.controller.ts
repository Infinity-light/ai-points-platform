import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { CompositeAuthGuard } from '../auth/guards/composite-auth.guard';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsUUID, IsNotEmpty } from 'class-validator';

class TriggerSettlementDto {
  @IsUUID()
  @IsNotEmpty()
  voteSessionId!: string;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('settlements')
@UseGuards(CompositeAuthGuard, PoliciesGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post()
  @CheckPolicies('settlements', 'trigger')
  trigger(@Body() dto: TriggerSettlementDto, @Request() req: RequestWithUser) {
    return this.settlementService.triggerSettlement(dto.voteSessionId, req.user.tenantId, req.user.sub);
  }

  @Post('project/:projectId/settle')
  @CheckPolicies('settlements', 'trigger')
  settleProject(@Param('projectId') projectId: string, @Request() req: RequestWithUser) {
    return this.settlementService.settleProject(projectId, req.user.tenantId, req.user.sub);
  }

  @Get('project/:projectId')
  @CheckPolicies('settlements', 'read')
  findForProject(@Param('projectId') projectId: string, @Request() req: RequestWithUser) {
    return this.settlementService.findForProject(req.user.tenantId, projectId);
  }
}
