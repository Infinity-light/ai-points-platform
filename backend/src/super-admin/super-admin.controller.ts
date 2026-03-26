import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { CreateTenantDto } from '../tenant/dto/create-tenant.dto';
import { UpdateTenantDto } from '../tenant/dto/update-tenant.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../user/guards/roles.guard';
import { Roles } from '../user/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // Tenant endpoints
  @Get('tenants')
  listTenants() {
    return this.superAdminService.listTenants();
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.superAdminService.createTenant(dto);
  }

  @Patch('tenants/:id')
  updateTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.superAdminService.updateTenant(id, dto);
  }

  @Delete('tenants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTenant(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.superAdminService.removeTenant(id);
  }

  // Config endpoints
  @Get('config')
  getConfig() {
    return this.superAdminService.getConfig();
  }

  @Patch('config')
  updateConfig(@Body() dto: UpdateConfigDto) {
    return this.superAdminService.updateConfig(dto);
  }

  // Ops stats
  @Get('ops')
  getOps() {
    return this.superAdminService.getOps();
  }
}
