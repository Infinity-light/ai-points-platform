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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../user/guards/roles.guard';
import { Roles } from '../user/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';
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
@UseGuards(JwtAuthGuard)
export class DividendController {
  constructor(private readonly dividendService: DividendService) {}

  @Get('project/:projectId')
  findForProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.findForProject(req.user.tenantId, projectId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.findOne(id, req.user.tenantId);
  }

  @Patch(':id/fill-amount')
  fillAmount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FillAmountDto,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.fillAmount(id, req.user.tenantId, dto.totalAmount);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.approve(id, req.user.tenantId, req.user.sub);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.dividendService.reject(id, req.user.tenantId);
  }
}
