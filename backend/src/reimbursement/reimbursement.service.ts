import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Reimbursement, ReimbursementType } from './entities/reimbursement.entity';
import { ReimbursementItem } from './entities/reimbursement-item.entity';
import { ApprovalService } from '../approval/approval.service';

export interface CreateReimbursementItemInput {
  description: string;
  amount: number;
  expenseDate: string;
  receiptUploadIds?: string[];
}

export interface CreateReimbursementInput {
  reimbursementType: ReimbursementType;
  title: string;
  notes?: string;
  items: CreateReimbursementItemInput[];
}

export interface UpdateReimbursementInput {
  title?: string;
  notes?: string;
  items?: CreateReimbursementItemInput[];
}

export interface MarkPaidInput {
  paymentReference?: string;
}

export interface ReimbursementFilters {
  submitterId?: string;
  status?: string;
}

@Injectable()
export class ReimbursementService {
  private readonly logger = new Logger(ReimbursementService.name);

  constructor(
    @InjectRepository(Reimbursement)
    private readonly reimbursementRepo: Repository<Reimbursement>,
    @InjectRepository(ReimbursementItem)
    private readonly itemRepo: Repository<ReimbursementItem>,
    private readonly approvalService: ApprovalService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private calcTotal(items: Array<{ amount: number }>): number {
    return items.reduce((sum, item) => sum + Number(item.amount), 0);
  }

  async create(
    tenantId: string,
    submitterId: string,
    input: CreateReimbursementInput,
  ): Promise<Reimbursement> {
    const reimbursement = this.reimbursementRepo.create({
      tenantId,
      submitterId,
      reimbursementType: input.reimbursementType,
      title: input.title,
      notes: input.notes ?? null,
      status: 'draft',
      totalAmount: this.calcTotal(input.items),
      linkedAssetId: null,
      approvalInstanceId: null,
      paidAt: null,
      paymentReference: null,
    });

    const saved = await this.reimbursementRepo.save(reimbursement);

    const itemEntities = input.items.map((item) =>
      this.itemRepo.create({
        reimbursementId: saved.id,
        description: item.description,
        amount: item.amount,
        expenseDate: item.expenseDate,
        receiptUploadIds: item.receiptUploadIds ?? [],
      }),
    );
    await this.itemRepo.save(itemEntities);

    return this.findOne(saved.id, tenantId);
  }

  async findAll(tenantId: string, filters?: ReimbursementFilters): Promise<Reimbursement[]> {
    const query = this.reimbursementRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.items', 'items')
      .where('r."tenantId" = :tenantId', { tenantId })
      .orderBy('r."createdAt"', 'DESC');

    if (filters?.submitterId) {
      query.andWhere('r."submitterId" = :submitterId', { submitterId: filters.submitterId });
    }
    if (filters?.status) {
      query.andWhere('r.status = :status', { status: filters.status });
    }

    return query.getMany();
  }

  async findOne(id: string, tenantId: string): Promise<Reimbursement> {
    const reimbursement = await this.reimbursementRepo.findOne({
      where: { id, tenantId },
      relations: ['items'],
    });
    if (!reimbursement) {
      throw new NotFoundException(`报销单 ${id} 不存在`);
    }
    return reimbursement;
  }

  // Lightweight load for state-transition methods that don't need items joined
  private async findForMutation(id: string, tenantId: string): Promise<Reimbursement> {
    const reimbursement = await this.reimbursementRepo.findOne({ where: { id, tenantId } });
    if (!reimbursement) {
      throw new NotFoundException(`报销单 ${id} 不存在`);
    }
    return reimbursement;
  }

  async update(
    id: string,
    tenantId: string,
    submitterId: string,
    input: UpdateReimbursementInput,
  ): Promise<Reimbursement> {
    const reimbursement = await this.findOne(id, tenantId);

    if (reimbursement.status !== 'draft') {
      throw new BadRequestException('只能修改草稿状态的报销');
    }
    if (reimbursement.submitterId !== submitterId) {
      throw new BadRequestException('只能修改自己的报销');
    }

    if (input.title !== undefined) reimbursement.title = input.title;
    if (input.notes !== undefined) reimbursement.notes = input.notes ?? null;

    if (input.items !== undefined) {
      await this.itemRepo.delete({ reimbursementId: id });

      const itemEntities = input.items.map((item) =>
        this.itemRepo.create({
          reimbursementId: id,
          description: item.description,
          amount: item.amount,
          expenseDate: item.expenseDate,
          receiptUploadIds: item.receiptUploadIds ?? [],
        }),
      );
      await this.itemRepo.save(itemEntities);
      reimbursement.totalAmount = this.calcTotal(input.items);
    }

    await this.reimbursementRepo.save(reimbursement);
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string, submitterId: string): Promise<void> {
    const reimbursement = await this.findForMutation(id, tenantId);

    if (reimbursement.status !== 'draft') {
      throw new BadRequestException('只能删除草稿状态的报销');
    }
    if (reimbursement.submitterId !== submitterId) {
      throw new BadRequestException('只能删除自己的报销');
    }

    await this.reimbursementRepo.remove(reimbursement);
  }

  async submit(
    id: string,
    tenantId: string,
    submitterId: string,
    departmentHeadId?: string,
  ): Promise<Reimbursement> {
    const reimbursement = await this.findForMutation(id, tenantId);

    if (reimbursement.status !== 'draft') {
      throw new BadRequestException('只能提交草稿状态的报销');
    }
    if (reimbursement.submitterId !== submitterId) {
      throw new BadRequestException('只能提交自己的报销');
    }
    const itemCount = await this.itemRepo.count({ where: { reimbursementId: id } });
    if (itemCount === 0) {
      throw new BadRequestException('报销必须包含至少一条明细');
    }

    const instance = await this.approvalService.createInstance({
      tenantId,
      businessType: 'reimbursement',
      businessId: reimbursement.id,
      submitterId,
      submitterDepartmentHeadId: departmentHeadId,
    });

    reimbursement.status = 'submitted';
    reimbursement.approvalInstanceId = instance.id;
    return this.reimbursementRepo.save(reimbursement);
  }

  async markPaid(id: string, tenantId: string, input: MarkPaidInput): Promise<Reimbursement> {
    const reimbursement = await this.findForMutation(id, tenantId);

    if (reimbursement.status !== 'leader_approved') {
      throw new BadRequestException('只能对已审批通过的报销标记付款');
    }

    reimbursement.status = 'paid';
    reimbursement.paidAt = new Date();
    reimbursement.paymentReference = input.paymentReference ?? null;
    return this.reimbursementRepo.save(reimbursement);
  }

  async markComplete(id: string, tenantId: string, _submitterId: string): Promise<Reimbursement> {
    const reimbursement = await this.findForMutation(id, tenantId);

    if (reimbursement.status !== 'paid') {
      throw new BadRequestException('只能确认已付款的报销');
    }

    reimbursement.status = 'completed';
    const saved = await this.reimbursementRepo.save(reimbursement);

    if (reimbursement.reimbursementType === 'asset_purchase') {
      this.eventEmitter.emit('reimbursement.asset_purchase_completed', {
        reimbursement: saved,
        tenantId,
      });
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
    if (event.businessType !== 'reimbursement') return;

    try {
      const reimbursement = await this.reimbursementRepo.findOne({
        where: { id: event.businessId, tenantId: event.tenantId },
      });
      if (!reimbursement) return;

      if (event.decision === 'rejected' || event.decision === 'returned') {
        reimbursement.status = 'rejected';
      } else if (event.decision === 'approved') {
        reimbursement.status = 'leader_approved';
      }

      await this.reimbursementRepo.save(reimbursement);
    } catch (err) {
      this.logger.warn(
        `handleApprovalCompleted failed for reimbursement ${event.businessId}: ${(err as Error).message}`,
      );
    }
  }
}
