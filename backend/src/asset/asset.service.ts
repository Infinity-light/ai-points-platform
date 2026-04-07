import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Asset, AssetStatus } from './entities/asset.entity';
import { AssetOperation, AssetOperationType } from './entities/asset-operation.entity';
import { AssetCodeSequence } from './entities/asset-code-sequence.entity';
import { ApprovalService } from '../approval/approval.service';

export interface CreateAssetDto {
  name: string;
  assetType: 'physical' | 'virtual';
  category: string;
  purchasePrice?: number | null;
  usefulLifeMonths?: number | null;
  residualValue?: number | null;
  purchaseDate?: string | null;
  vendor?: string | null;
  serialNumber?: string | null;
  expiresAt?: string | null;
  assignedUserId?: string | null;
  departmentId?: string | null;
  notes?: string | null;
}

export interface UpdateAssetDto {
  name?: string;
  status?: AssetStatus;
  purchasePrice?: number | null;
  usefulLifeMonths?: number | null;
  residualValue?: number | null;
  purchaseDate?: string | null;
  vendor?: string | null;
  serialNumber?: string | null;
  expiresAt?: string | null;
  assignedUserId?: string | null;
  departmentId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AssetFilters {
  status?: string;
  assetType?: string;
  category?: string;
  assignedUserId?: string;
}

export interface ExecuteOperationDto {
  operationType: AssetOperationType;
  toUserId?: string;
  notes?: string;
  departmentHeadId?: string;
}

export interface DepreciationResult {
  accumulated: number;
  bookValue: number;
  monthlyRate: number;
}

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(AssetOperation)
    private readonly operationRepo: Repository<AssetOperation>,
    private readonly approvalService: ApprovalService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async generateAssetCode(tenantId: string, category: string): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const year = new Date().getFullYear();
      const prefix = category.toUpperCase().substring(0, 3);

      let seq = await manager.findOne(AssetCodeSequence, {
        where: { tenantId, category, year },
        lock: { mode: 'pessimistic_write' },
      });

      if (!seq) {
        seq = manager.create(AssetCodeSequence, { tenantId, category, year, lastSeq: 0 });
      }

      seq.lastSeq += 1;
      await manager.save(AssetCodeSequence, seq);

      return `${prefix}-${year}-${String(seq.lastSeq).padStart(4, '0')}`;
    });
  }

  async create(tenantId: string, createdBy: string, dto: CreateAssetDto): Promise<Asset> {
    const assetCode = await this.generateAssetCode(tenantId, dto.category);
    const asset = this.assetRepo.create({
      tenantId,
      assetCode,
      name: dto.name,
      assetType: dto.assetType,
      category: dto.category,
      status: dto.assetType === 'virtual' ? 'active' : 'pending_acceptance',
      purchasePrice: dto.purchasePrice ?? null,
      usefulLifeMonths: dto.usefulLifeMonths ?? null,
      residualValue: dto.residualValue ?? null,
      purchaseDate: dto.purchaseDate ?? null,
      vendor: dto.vendor ?? null,
      serialNumber: dto.serialNumber ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      assignedUserId: dto.assignedUserId ?? null,
      departmentId: dto.departmentId ?? null,
      notes: dto.notes ?? null,
      createdBy,
      metadata: {},
    });

    const saved = await this.assetRepo.save(asset);
    this.eventEmitter.emit('asset.created', { asset: saved, tenantId });
    return saved;
  }

  async findAll(tenantId: string, filters?: AssetFilters): Promise<Asset[]> {
    const query = this.assetRepo
      .createQueryBuilder('asset')
      .where('asset."tenantId" = :tenantId', { tenantId })
      .orderBy('asset."createdAt"', 'DESC');

    if (filters?.status) {
      query.andWhere('asset.status = :status', { status: filters.status });
    }
    if (filters?.assetType) {
      query.andWhere('asset."assetType" = :assetType', { assetType: filters.assetType });
    }
    if (filters?.category) {
      query.andWhere('asset.category = :category', { category: filters.category });
    }
    if (filters?.assignedUserId) {
      query.andWhere('asset."assignedUserId" = :assignedUserId', {
        assignedUserId: filters.assignedUserId,
      });
    }

    return query.getMany();
  }

  async findOne(id: string, tenantId: string): Promise<Asset> {
    const asset = await this.assetRepo.findOne({ where: { id, tenantId } });
    if (!asset) {
      throw new NotFoundException(`资产 ${id} 不存在`);
    }
    return asset;
  }

  async update(id: string, tenantId: string, dto: UpdateAssetDto): Promise<Asset> {
    const asset = await this.findOne(id, tenantId);

    if (dto.name !== undefined) asset.name = dto.name;
    if (dto.status !== undefined) asset.status = dto.status;
    if (dto.purchasePrice !== undefined) asset.purchasePrice = dto.purchasePrice;
    if (dto.usefulLifeMonths !== undefined) asset.usefulLifeMonths = dto.usefulLifeMonths;
    if (dto.residualValue !== undefined) asset.residualValue = dto.residualValue;
    if (dto.purchaseDate !== undefined) asset.purchaseDate = dto.purchaseDate;
    if (dto.vendor !== undefined) asset.vendor = dto.vendor;
    if (dto.serialNumber !== undefined) asset.serialNumber = dto.serialNumber;
    if (dto.expiresAt !== undefined) {
      asset.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.assignedUserId !== undefined) asset.assignedUserId = dto.assignedUserId;
    if (dto.departmentId !== undefined) asset.departmentId = dto.departmentId;
    if (dto.notes !== undefined) asset.notes = dto.notes;
    if (dto.metadata !== undefined) asset.metadata = dto.metadata;

    return this.assetRepo.save(asset);
  }

  async executeOperation(
    assetId: string,
    tenantId: string,
    operatedBy: string,
    dto: ExecuteOperationDto,
  ): Promise<AssetOperation> {
    const asset = await this.findOne(assetId, tenantId);

    this.validateTransition(asset, dto.operationType);

    const needsApproval = ['dispose', 'transfer'].includes(dto.operationType);

    let approvalInstanceId: string | null = null;
    if (needsApproval) {
      const instance = await this.approvalService.createInstance({
        tenantId,
        businessType: 'asset_operation',
        businessId: assetId,
        submitterId: operatedBy,
        submitterDepartmentHeadId: dto.departmentHeadId,
      });
      approvalInstanceId = instance.id;
    }

    const operation = this.operationRepo.create({
      tenantId,
      assetId,
      operationType: dto.operationType,
      fromUserId: asset.assignedUserId,
      toUserId: dto.toUserId ?? null,
      approvalInstanceId,
      notes: dto.notes ?? null,
      operatedBy,
    });
    const saved = await this.operationRepo.save(operation);

    if (!needsApproval) {
      this.applyOperation(asset, dto.operationType, dto.toUserId ?? null);
      await this.assetRepo.save(asset);
    }

    return saved;
  }

  @OnEvent('approval.completed')
  async handleApprovalCompleted(event: {
    decision: string;
    businessType: string;
    businessId: string;
    tenantId: string;
  }): Promise<void> {
    if (event.businessType !== 'asset_operation') return;

    try {
      const asset = await this.assetRepo.findOne({
        where: { id: event.businessId, tenantId: event.tenantId },
      });
      if (!asset) return;

      if (event.decision === 'approved') {
        const operation = await this.operationRepo.findOne({
          where: { assetId: asset.id, tenantId: event.tenantId },
          order: { createdAt: 'DESC' },
        });
        if (operation) {
          this.applyOperation(asset, operation.operationType, operation.toUserId);
          await this.assetRepo.save(asset);
        }
      }
    } catch (err) {
      this.logger.warn(
        `handleApprovalCompleted failed for asset ${event.businessId}: ${(err as Error).message}`,
      );
    }
  }

  private validateTransition(asset: Asset, operationType: AssetOperationType): void {
    const transitions: Record<string, string[]> = {
      pending_acceptance: ['accept'],
      in_use: ['return', 'transfer', 'repair_start', 'loan', 'dispose'],
      idle: ['assign', 'dispose', 'transfer'],
      on_loan: ['loan_return'],
      under_repair: ['repair_end'],
      active: ['renew', 'dispose'],
      expiring_soon: ['renew', 'dispose'],
      expired: ['renew', 'dispose'],
    };

    const allowed = transitions[asset.status] ?? [];
    if (!allowed.includes(operationType)) {
      throw new BadRequestException(`资产状态 "${asset.status}" 不允许操作 "${operationType}"`);
    }
  }

  private applyOperation(
    asset: Asset,
    operationType: AssetOperationType,
    toUserId: string | null,
  ): void {
    const statusMap: Record<string, string> = {
      accept: 'in_use',
      assign: 'in_use',
      return: 'idle',
      transfer: 'in_use',
      repair_start: 'under_repair',
      repair_end: 'in_use',
      loan: 'on_loan',
      loan_return: 'in_use',
      dispose: asset.assetType === 'virtual' ? 'decommissioned' : 'disposed',
      renew: 'active',
    };

    asset.status = (statusMap[operationType] ?? asset.status) as AssetStatus;

    if (['assign', 'transfer'].includes(operationType) && toUserId) {
      asset.assignedUserId = toUserId;
    }
    if (['return', 'dispose'].includes(operationType)) {
      asset.assignedUserId = null;
    }
  }

  @OnEvent('reimbursement.asset_purchase_completed')
  async handleReimbursementAssetPurchase(event: {
    reimbursement: {
      id: string;
      title: string;
      totalAmount: number;
      submitterId: string;
    };
    tenantId: string;
  }): Promise<void> {
    try {
      const { reimbursement, tenantId } = event;
      await this.create(tenantId, reimbursement.submitterId, {
        name: reimbursement.title,
        assetType: 'physical',
        category: 'purchase',
        purchasePrice: Number(reimbursement.totalAmount),
        purchaseDate: new Date().toISOString().split('T')[0],
        notes: `由报销单 ${reimbursement.id} 自动创建`,
      });
      this.logger.log(
        `Auto-created asset from reimbursement ${reimbursement.id} in tenant ${tenantId}`,
      );
    } catch (err) {
      this.logger.warn(
        `handleReimbursementAssetPurchase failed for reimbursement ${event.reimbursement.id}: ${(err as Error).message}`,
      );
    }
  }

  calculateDepreciation(asset: Asset): DepreciationResult {
    if (!asset.purchasePrice || !asset.usefulLifeMonths || !asset.purchaseDate) {
      return {
        accumulated: 0,
        bookValue: asset.purchasePrice ? Number(asset.purchasePrice) : 0,
        monthlyRate: 0,
      };
    }

    const price = Number(asset.purchasePrice);
    const residual = Number(asset.residualValue ?? 0);
    const months = asset.usefulLifeMonths;
    const monthlyRate = (price - residual) / months;

    const purchaseDate = new Date(asset.purchaseDate);
    const now = new Date();
    const monthsElapsed =
      (now.getFullYear() - purchaseDate.getFullYear()) * 12 +
      (now.getMonth() - purchaseDate.getMonth());

    const accumulated = Math.min(monthlyRate * Math.max(monthsElapsed, 0), price - residual);
    const bookValue = Math.max(price - accumulated, residual);

    return {
      accumulated: Math.round(accumulated * 100) / 100,
      bookValue: Math.round(bookValue * 100) / 100,
      monthlyRate: Math.round(monthlyRate * 100) / 100,
    };
  }

  async getOperations(assetId: string, tenantId: string): Promise<AssetOperation[]> {
    return this.operationRepo.find({
      where: { assetId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }
}
