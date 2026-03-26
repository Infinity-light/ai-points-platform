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
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from './enums/role.enum';
import { CurrentTenant } from '../tenant/decorators/tenant.decorator';

interface RequestUser {
  id: string;
  tenantId: string;
  role: Role;
}

// JwtAuthGuard 将在 Auth 模块实现后加入
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
    // 普通用户不能修改自己的角色
    const { role: _role, ...safeDto } = dto;
    return this.userService.update(user.id, user.tenantId, safeDto);
  }

  // HR 管理员接口
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  findAll(@CurrentTenant() tenantId: string): Promise<User[]> {
    return this.userService.findAllByTenant(tenantId);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: Pick<UpdateUserDto, 'role'>,
  ): Promise<User> {
    return this.userService.update(id, tenantId, { role: dto.role });
  }
}
