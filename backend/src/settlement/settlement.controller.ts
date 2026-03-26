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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../user/guards/roles.guard';
import { Roles } from '../user/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';
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
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post()
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  trigger(@Body() dto: TriggerSettlementDto, @Request() req: RequestWithUser) {
    return this.settlementService.triggerSettlement(dto.voteSessionId, req.user.tenantId, req.user.sub);
  }

  @Get('project/:projectId')
  findForProject(@Param('projectId') projectId: string, @Request() req: RequestWithUser) {
    return this.settlementService.findForProject(req.user.tenantId, projectId);
  }
}
