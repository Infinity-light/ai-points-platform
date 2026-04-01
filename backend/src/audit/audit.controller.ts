import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { CurrentTenant } from '../tenant/decorators/tenant.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@CheckPolicies('audit', 'read')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  listLogs(
    @CurrentTenant() tenantId: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('actorId') actorId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    const safeLimit = Math.min(limit, 100);
    return this.auditService.list(
      tenantId,
      { action, resource, actorId },
      page,
      safeLimit,
    );
  }

  @Get('logs/:resource/:resourceId')
  getByResource(
    @CurrentTenant() tenantId: string,
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.auditService.getByResource(tenantId, resource, resourceId);
  }
}
