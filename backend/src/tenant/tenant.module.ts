import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { Tenant } from './entities/tenant.entity';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { TenantRequiredGuard } from './guards/tenant-required.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [TenantController],
  providers: [TenantService, TenantInterceptor, TenantRequiredGuard],
  exports: [TenantService, TenantInterceptor, TenantRequiredGuard],
})
export class TenantModule {}
