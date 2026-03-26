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
import { RolesGuard } from '../user/guards/roles.guard';
import { Roles } from '../user/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';

interface RequestWithUser extends Request {
  user: { sub: string; tenantId: string; role: Role };
}

@Controller('invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  create(@Body() dto: CreateInviteDto, @Request() req: RequestWithUser) {
    return this.inviteService.create(req.user.tenantId, req.user.sub, dto);
  }

  @Get()
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  findAll(@Request() req: RequestWithUser) {
    return this.inviteService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.inviteService.findOne(id, req.user.tenantId);
  }

  @Patch(':id/deactivate')
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  deactivate(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.inviteService.deactivate(id, req.user.tenantId);
  }

  @Get(':id/usages')
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  getUsageHistory(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.inviteService.getUsageHistory(id, req.user.tenantId);
  }
}
