import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CompositeAuthGuard } from '../auth/guards/composite-auth.guard';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AiProviderService } from './ai-provider.service';
import { OpenApiKeyService } from './open-api-key.service';
import { CreateAiProviderDto, CreateAiProviderKeyDto } from './dto/create-ai-provider.dto';
import { CreateOpenApiKeyDto } from './dto/create-open-api-key.dto';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

// NOTE: All endpoints require `config:manage` permission.
// Ensure RBAC seed data includes resource='config', action='manage'
// for super_admin and hr_admin roles.
@Controller('ai-config')
@UseGuards(CompositeAuthGuard, PoliciesGuard)
@CheckPolicies('config', 'manage')
export class AiConfigController {
  constructor(
    private readonly aiProviderService: AiProviderService,
    private readonly openApiKeyService: OpenApiKeyService,
  ) {}

  // ─── AI Providers ──────────────────────────────────────────────────────────

  @Get('providers')
  listProviders(@Request() req: RequestWithUser) {
    return this.aiProviderService.list(req.user.tenantId);
  }

  @Post('providers')
  createProvider(
    @Request() req: RequestWithUser,
    @Body() dto: CreateAiProviderDto,
  ) {
    return this.aiProviderService.create(req.user.tenantId, dto);
  }

  @Patch('providers/:id')
  updateProvider(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @Body() dto: Partial<CreateAiProviderDto>,
  ) {
    return this.aiProviderService.update(id, req.user.tenantId, dto);
  }

  @Delete('providers/:id')
  removeProvider(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.aiProviderService.remove(id, req.user.tenantId);
  }

  // ─── Provider Keys ─────────────────────────────────────────────────────────

  @Get('providers/:id/keys')
  listKeys(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.aiProviderService.listKeys(id, req.user.tenantId);
  }

  @Post('providers/:id/keys')
  addKey(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @Body() dto: CreateAiProviderKeyDto,
  ) {
    return this.aiProviderService.addKey(id, req.user.tenantId, dto);
  }

  @Delete('providers/:id/keys/:keyId')
  removeKey(@Param('keyId') keyId: string, @Request() req: RequestWithUser) {
    return this.aiProviderService.removeKey(keyId, req.user.tenantId);
  }

  // ─── Open API Keys ─────────────────────────────────────────────────────────

  @Get('open-api-keys')
  listOpenApiKeys(@Request() req: RequestWithUser) {
    return this.openApiKeyService.list(req.user.tenantId);
  }

  @Post('open-api-keys')
  createOpenApiKey(
    @Request() req: RequestWithUser,
    @Body() dto: CreateOpenApiKeyDto,
  ) {
    // Returns { key: OpenApiKey, rawKey: string } — rawKey visible only once
    return this.openApiKeyService.create(req.user.tenantId, req.user.sub, dto);
  }

  @Delete('open-api-keys/:id')
  revokeOpenApiKey(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.openApiKeyService.revoke(id, req.user.tenantId);
  }
}
