import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { CurrentUser } from './decorators/current-user.decorator';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { CurrentTenant } from '../tenant/decorators/tenant.decorator';

interface RequestUser {
  id: string;
  tenantId: string;
  email: string;
}

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(@CurrentUser() user: RequestUser): Promise<User> {
    return this.userService.findById(user.id, user.tenantId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.userService.update(user.id, user.tenantId, dto);
  }

  @Get()
  @UseGuards(PoliciesGuard)
  @CheckPolicies('users', 'read')
  findAll(@CurrentTenant() tenantId: string): Promise<User[]> {
    return this.userService.findAllByTenant(tenantId);
  }

  @Patch(':id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies('users', 'update')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.userService.update(id, tenantId, dto);
  }
}
