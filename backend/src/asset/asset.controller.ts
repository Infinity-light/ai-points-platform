import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsPositive,
  IsDateString,
  IsInt,
  Min,
  IsIn,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssetService } from './asset.service';
import type { AssetFilters } from './asset.service';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { AssetStatus } from './entities/asset.entity';
import type { AssetOperationType } from './entities/asset-operation.entity';

class CreateAssetBodyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn(['physical', 'virtual'])
  assetType!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  purchasePrice?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  usefulLifeMonths?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  residualValue?: number;

  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @IsString()
  @IsOptional()
  vendor?: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsUUID()
  @IsOptional()
  assignedUserId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

class UpdateAssetBodyDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  purchasePrice?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  usefulLifeMonths?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  residualValue?: number;

  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @IsString()
  @IsOptional()
  vendor?: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsUUID()
  @IsOptional()
  assignedUserId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

class ExecuteOperationBodyDto {
  @IsString()
  @IsIn([
    'accept',
    'assign',
    'return',
    'transfer',
    'repair_start',
    'repair_end',
    'loan',
    'loan_return',
    'dispose',
    'renew',
  ])
  operationType!: string;

  @IsUUID()
  @IsOptional()
  toUserId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  departmentHeadId?: string;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('assets')
@UseGuards(PoliciesGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  @CheckPolicies('assets', 'read')
  list(
    @Request() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('assetType') assetType?: string,
    @Query('category') category?: string,
    @Query('assignedUserId') assignedUserId?: string,
  ) {
    const filters: AssetFilters = {};
    if (status) filters.status = status;
    if (assetType) filters.assetType = assetType;
    if (category) filters.category = category;
    if (assignedUserId) filters.assignedUserId = assignedUserId;
    return this.assetService.findAll(req.user.tenantId, filters);
  }

  @Post()
  @CheckPolicies('assets', 'create')
  create(@Request() req: RequestWithUser, @Body() dto: CreateAssetBodyDto) {
    return this.assetService.create(req.user.tenantId, req.user.sub, {
      name: dto.name,
      assetType: dto.assetType as 'physical' | 'virtual',
      category: dto.category,
      purchasePrice: dto.purchasePrice ?? null,
      usefulLifeMonths: dto.usefulLifeMonths ?? null,
      residualValue: dto.residualValue ?? null,
      purchaseDate: dto.purchaseDate ?? null,
      vendor: dto.vendor ?? null,
      serialNumber: dto.serialNumber ?? null,
      expiresAt: dto.expiresAt ?? null,
      assignedUserId: dto.assignedUserId ?? null,
      departmentId: dto.departmentId ?? null,
      notes: dto.notes ?? null,
    });
  }

  @Get(':id')
  @CheckPolicies('assets', 'read')
  findOne(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.assetService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @CheckPolicies('assets', 'update')
  update(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssetBodyDto,
  ) {
    return this.assetService.update(id, req.user.tenantId, {
      name: dto.name,
      status: dto.status as AssetStatus | undefined,
      purchasePrice: dto.purchasePrice,
      usefulLifeMonths: dto.usefulLifeMonths,
      residualValue: dto.residualValue,
      purchaseDate: dto.purchaseDate,
      vendor: dto.vendor,
      serialNumber: dto.serialNumber,
      expiresAt: dto.expiresAt,
      assignedUserId: dto.assignedUserId,
      departmentId: dto.departmentId,
      notes: dto.notes,
      metadata: dto.metadata,
    });
  }

  @Post(':id/operations')
  @CheckPolicies('assets', 'update')
  executeOperation(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ExecuteOperationBodyDto,
  ) {
    return this.assetService.executeOperation(id, req.user.tenantId, req.user.sub, {
      operationType: dto.operationType as AssetOperationType,
      toUserId: dto.toUserId,
      notes: dto.notes,
      departmentHeadId: dto.departmentHeadId,
    });
  }

  @Get(':id/operations')
  @CheckPolicies('assets', 'read')
  getOperations(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.assetService.getOperations(id, req.user.tenantId);
  }

  @Get(':id/depreciation')
  @CheckPolicies('assets', 'read')
  async getDepreciation(@Request() req: RequestWithUser, @Param('id') id: string) {
    const asset = await this.assetService.findOne(id, req.user.tenantId);
    return this.assetService.calculateDepreciation(asset);
  }
}
