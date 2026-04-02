import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DividendService } from './dividend.service';
import { CompositeAuthGuard } from '../auth/guards/composite-auth.guard';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsNumber, IsPositive } from 'class-validator';

class FillAmountDto {
  @IsNumber()
  @IsPositive()
  totalAmount!: number;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('dividends')
@UseGuards(CompositeAuthGuard, PoliciesGuard)
export class DividendController {
  constructor(private readonly dividendService: DividendService) {}

  @Get('project/:projectId')
  @CheckPolicies('dividends', 'read')
  findForProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.findForProject(req.user.tenantId, projectId);
  }

  @Get(':id')
  @CheckPolicies('dividends', 'read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.findOne(id, req.user.tenantId);
  }

  @Patch(':id/fill-amount')
  @CheckPolicies('dividends', 'create')
  fillAmount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FillAmountDto,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.fillAmount(id, req.user.tenantId, dto.totalAmount);
  }

  @Patch(':id/approve')
  @CheckPolicies('dividends', 'create')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.approve(id, req.user.tenantId, req.user.sub);
  }

  @Patch(':id/reject')
  @CheckPolicies('dividends', 'create')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.reject(id, req.user.tenantId);
  }
}
