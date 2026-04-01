import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InviteService } from './invite.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('invites')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @CheckPolicies('users', 'create')
  create(@Body() dto: CreateInviteDto, @Request() req: RequestWithUser) {
    return this.inviteService.create(req.user.tenantId, req.user.sub, dto);
  }

  @Get()
  @CheckPolicies('users', 'read')
  findAll(@Request() req: RequestWithUser) {
    return this.inviteService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @CheckPolicies('users', 'read')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.inviteService.findOne(id, req.user.tenantId);
  }

  @Patch(':id/deactivate')
  @CheckPolicies('users', 'update')
  deactivate(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.inviteService.deactivate(id, req.user.tenantId);
  }

  @Get(':id/usages')
  @CheckPolicies('users', 'read')
  getUsageHistory(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.inviteService.getUsageHistory(id, req.user.tenantId);
  }
}
