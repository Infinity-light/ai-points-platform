import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsUUID, IsNotEmpty, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BitableSyncService } from './bitable-sync.service';
import type {
  SyncDirection,
  ConflictStrategy,
  BitableFieldMapping,
} from '../feishu/entities/feishu-bitable-binding.entity';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

class CreateBindingBodyDto {
  @IsUUID()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  appToken!: string;

  @IsString()
  @IsNotEmpty()
  tableId!: string;

  @IsString()
  @IsOptional()
  entityType?: string;

  @IsIn(['push_only', 'pull_only', 'bidirectional'])
  @IsOptional()
  syncDirection?: SyncDirection;

  @IsIn(['last_write_wins', 'platform_wins', 'feishu_wins'])
  @IsOptional()
  conflictStrategy?: ConflictStrategy;

  @IsOptional()
  fieldMapping?: BitableFieldMapping;

  @IsString()
  @IsOptional()
  writebackFieldId?: string | null;
}

class UpdateBindingBodyDto {
  @IsString()
  @IsOptional()
  appToken?: string;

  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsOptional()
  entityType?: string;

  @IsIn(['push_only', 'pull_only', 'bidirectional'])
  @IsOptional()
  syncDirection?: SyncDirection;

  @IsIn(['last_write_wins', 'platform_wins', 'feishu_wins'])
  @IsOptional()
  conflictStrategy?: ConflictStrategy;

  @IsOptional()
  fieldMapping?: BitableFieldMapping;

  @IsString()
  @IsOptional()
  writebackFieldId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

@Controller('admin/bitable-sync')
@UseGuards(PoliciesGuard)
export class BitableSyncController {
  constructor(private readonly syncService: BitableSyncService) {}

  @Post('bindings')
  @CheckPolicies('bitable-sync', 'create')
  create(@Request() req: RequestWithUser, @Body() dto: CreateBindingBodyDto) {
    return this.syncService.createBinding(req.user.tenantId, {
      projectId: dto.projectId,
      appToken: dto.appToken,
      tableId: dto.tableId,
      entityType: dto.entityType,
      syncDirection: dto.syncDirection,
      conflictStrategy: dto.conflictStrategy,
      fieldMapping: dto.fieldMapping,
      writebackFieldId: dto.writebackFieldId,
    });
  }

  @Get('bindings')
  @CheckPolicies('bitable-sync', 'read')
  list(@Request() req: RequestWithUser) {
    return this.syncService.listBindings(req.user.tenantId);
  }

  @Patch('bindings/:id')
  @CheckPolicies('bitable-sync', 'update')
  update(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateBindingBodyDto,
  ) {
    return this.syncService.updateBinding(id, req.user.tenantId, {
      appToken: dto.appToken,
      tableId: dto.tableId,
      entityType: dto.entityType,
      syncDirection: dto.syncDirection,
      conflictStrategy: dto.conflictStrategy,
      fieldMapping: dto.fieldMapping,
      writebackFieldId: dto.writebackFieldId,
      isActive: dto.isActive,
    });
  }

  @Delete('bindings/:id')
  @CheckPolicies('bitable-sync', 'delete')
  delete(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.syncService.deleteBinding(id, req.user.tenantId);
  }

  @Post('bindings/:id/sync')
  @CheckPolicies('bitable-sync', 'trigger')
  sync(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.syncService.triggerFullSync(id, req.user.tenantId);
  }

  @Get('bindings/:id/logs')
  @CheckPolicies('bitable-sync', 'read')
  logs(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.syncService.getSyncLogs(id, req.user.tenantId);
  }
}
