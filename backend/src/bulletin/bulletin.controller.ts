import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { BulletinService } from './bulletin.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

class PaginationQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

// ── Authenticated routes ──────────────────────────────────────────────────────

@Controller('bulletin')
// Auth handled by global CompositeAuthGuard
export class BulletinController {
  constructor(private readonly bulletinService: BulletinService) {}

  @Get('leaderboard')
  getLeaderboard(
    @Request() req: RequestWithUser,
    @Query('projectId') projectId?: string,
  ) {
    return this.bulletinService.getLeaderboard({
      tenantId: req.user.tenantId,
      projectId,
      sanitize: false,
    });
  }

  @Get('settlements')
  getSettlements(
    @Request() req: RequestWithUser,
    @Query() query: PaginationQuery,
  ) {
    return this.bulletinService.getSettlements({
      tenantId: req.user.tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('dividends')
  getDividends(
    @Request() req: RequestWithUser,
    @Query() query: PaginationQuery,
  ) {
    return this.bulletinService.getDividends({
      tenantId: req.user.tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('decisions')
  getDecisions(
    @Request() req: RequestWithUser,
    @Query() query: PaginationQuery,
  ) {
    return this.bulletinService.getDecisions({
      tenantId: req.user.tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('audit-trail')
  getAuditTrail(
    @Request() req: RequestWithUser,
    @Query() query: PaginationQuery,
  ) {
    return this.bulletinService.getAuditTrail({
      tenantId: req.user.tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sanitize: false,
    });
  }
}

// ── Public routes (no JWT required) ──────────────────────────────────────────

@Public()
@Controller('public/:tenantSlug/bulletin')
export class PublicBulletinController {
  constructor(private readonly bulletinService: BulletinService) {}

  @Get('leaderboard')
  async getPublicLeaderboard(
    @Param('tenantSlug') tenantSlug: string,
    @Query('projectId') projectId?: string,
  ) {
    const tenantId = await this.bulletinService.assertPublicBulletinEnabled(tenantSlug);
    return this.bulletinService.getLeaderboard({ tenantId, projectId, sanitize: true });
  }

  @Get('settlements')
  async getPublicSettlements(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: PaginationQuery,
  ) {
    const tenantId = await this.bulletinService.assertPublicBulletinEnabled(tenantSlug);
    return this.bulletinService.getSettlements({
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('decisions')
  async getPublicDecisions(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: PaginationQuery,
  ) {
    const tenantId = await this.bulletinService.assertPublicBulletinEnabled(tenantSlug);
    return this.bulletinService.getDecisions({
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('audit-trail')
  async getPublicAuditTrail(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: PaginationQuery,
  ) {
    const tenantId = await this.bulletinService.assertPublicBulletinEnabled(tenantSlug);
    return this.bulletinService.getAuditTrail({
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sanitize: true,
    });
  }
}
