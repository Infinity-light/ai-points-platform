import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalConfig, ApprovalConfigType } from './entities/approval-config.entity';
import { ApprovalInstance, ApprovalStatus } from './entities/approval-instance.entity';
import { ApprovalRecord, ApprovalAction } from './entities/approval-record.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';

const TERMINAL_STATUSES: ApprovalStatus[] = ['approved', 'rejected', 'returned'];
const ACTIVE_STATUSES: ApprovalStatus[] = ['pending', 'step1_approved', 'step2_approved'];

export interface UpsertConfigDto {
  configType: ApprovalConfigType;
  deptApproverMode?: 'department_head' | 'manual';
  financePersonId?: string | null;
  finalApproverId?: string | null;
  isActive?: boolean;
}

export interface ApproveDto {
  action: ApprovalAction;
  comment?: string;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @InjectRepository(ApprovalConfig)
    private readonly configRepo: Repository<ApprovalConfig>,
    @InjectRepository(ApprovalInstance)
    private readonly instanceRepo: Repository<ApprovalInstance>,
    @InjectRepository(ApprovalRecord)
    private readonly recordRepo: Repository<ApprovalRecord>,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationService: NotificationService,
  ) {}

  async getConfig(tenantId: string, configType: string): Promise<ApprovalConfig | null> {
    return this.configRepo.findOne({ where: { tenantId, configType: configType as ApprovalConfigType } });
  }

  async getAllConfigs(tenantId: string): Promise<ApprovalConfig[]> {
    return this.configRepo.find({ where: { tenantId }, order: { configType: 'ASC' } });
  }

  async upsertConfig(tenantId: string, dto: UpsertConfigDto): Promise<ApprovalConfig> {
    const existing = await this.configRepo.findOne({
      where: { tenantId, configType: dto.configType },
    });

    if (existing) {
      existing.deptApproverMode = dto.deptApproverMode ?? existing.deptApproverMode;
      existing.financePersonId = dto.financePersonId !== undefined ? (dto.financePersonId ?? null) : existing.financePersonId;
      existing.finalApproverId = dto.finalApproverId !== undefined ? (dto.finalApproverId ?? null) : existing.finalApproverId;
      if (dto.isActive !== undefined) {
        existing.isActive = dto.isActive;
      }
      return this.configRepo.save(existing);
    }

    const config = this.configRepo.create({
      tenantId,
      configType: dto.configType,
      deptApproverMode: dto.deptApproverMode ?? 'department_head',
      financePersonId: dto.financePersonId ?? null,
      finalApproverId: dto.finalApproverId ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.configRepo.save(config);
  }

  async createInstance(opts: {
    tenantId: string;
    businessType: string;
    businessId: string;
    submitterId: string;
    submitterDepartmentHeadId?: string;
  }): Promise<ApprovalInstance> {
    const { tenantId, businessType, businessId, submitterId, submitterDepartmentHeadId } = opts;

    const config = await this.configRepo.findOne({
      where: { tenantId, configType: businessType as ApprovalConfigType, isActive: true },
    });

    if (!config) {
      throw new BadRequestException(
        `No active approval config found for type '${businessType}' in this tenant`,
      );
    }

    const step1ApproverId = submitterDepartmentHeadId ?? null;
    const step2ApproverId = config.financePersonId;
    const step3ApproverId = config.finalApproverId;

    const instance = this.instanceRepo.create({
      tenantId,
      businessType: businessType as ApprovalInstance['businessType'],
      businessId,
      submitterId,
      status: 'pending',
      currentStep: 1,
      step1ApproverId,
      step2ApproverId,
      step3ApproverId,
      completedAt: null,
    });

    const saved = await this.instanceRepo.save(instance);

    if (step1ApproverId) {
      await this.notifyApprover({
        approverId: step1ApproverId,
        tenantId,
        instanceId: saved.id,
        step: 1,
        businessType,
      });
    }

    this.logger.log(`ApprovalInstance ${saved.id} created for ${businessType}/${businessId}`);
    return saved;
  }

  async getInstance(id: string, tenantId: string): Promise<ApprovalInstance> {
    const instance = await this.instanceRepo.findOne({
      where: { id, tenantId },
      relations: ['records'],
    });
    if (!instance) {
      throw new NotFoundException(`Approval instance ${id} not found`);
    }
    return instance;
  }

  async getPendingForUser(userId: string, tenantId: string): Promise<ApprovalInstance[]> {
    // Push approver filter into DB: match instances where the current step's approver column equals userId.
    // Step 1 approver is in step1ApproverId, step 2 in step2ApproverId, etc.
    // We use a raw OR condition to avoid loading the full tenant pending list into memory.
    return this.instanceRepo
      .createQueryBuilder('i')
      .where('i."tenantId" = :tenantId', { tenantId })
      .andWhere('i.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere(
        `(
          (i."currentStep" = 1 AND i."step1ApproverId" = :userId) OR
          (i."currentStep" = 2 AND i."step2ApproverId" = :userId) OR
          (i."currentStep" = 3 AND i."step3ApproverId" = :userId)
        )`,
        { userId },
      )
      .orderBy('i."createdAt"', 'DESC')
      .getMany();
  }

  async approve(
    instanceId: string,
    approverId: string,
    tenantId: string,
    dto: ApproveDto,
  ): Promise<ApprovalInstance> {
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId, tenantId },
      relations: ['records'],
    });

    if (!instance) {
      throw new NotFoundException(`Approval instance ${instanceId} not found`);
    }

    if (TERMINAL_STATUSES.includes(instance.status)) {
      throw new BadRequestException(`Instance is already ${instance.status}`);
    }

    const expectedApprover = this.getApproverForStep(instance, instance.currentStep);
    if (expectedApprover !== approverId) {
      throw new BadRequestException(
        `User ${approverId} is not the approver for step ${instance.currentStep}`,
      );
    }

    const record = this.recordRepo.create({
      instanceId,
      approverId,
      step: instance.currentStep,
      action: dto.action,
      comment: dto.comment ?? null,
    });
    await this.recordRepo.save(record);

    if (dto.action === 'rejected' || dto.action === 'returned') {
      await this.finalizeInstance(instance, dto.action, tenantId, instanceId);
      this.logger.log(`Instance ${instanceId} ${dto.action} at step ${instance.currentStep}`);
      return instance;
    }

    // action === 'approved': advance to next step or finalize
    const nextStep = instance.currentStep + 1;
    const nextApprover = this.getApproverForStep(instance, nextStep);

    if (nextStep <= 3 && nextApprover) {
      instance.currentStep = nextStep;
      instance.status = `step${instance.currentStep - 1}_approved` as ApprovalStatus;
      const [saved] = await Promise.all([
        this.instanceRepo.save(instance),
        this.notifyApprover({
          approverId: nextApprover,
          tenantId,
          instanceId,
          step: nextStep,
          businessType: instance.businessType,
        }),
      ]);
      this.logger.log(`Instance ${instanceId} advanced to step ${nextStep}`);
      return saved;
    }

    await this.finalizeInstance(instance, 'approved', tenantId, instanceId);
    this.logger.log(`Instance ${instanceId} fully approved`);
    return instance;
  }

  private async finalizeInstance(
    instance: ApprovalInstance,
    decision: 'approved' | 'rejected' | 'returned',
    tenantId: string,
    instanceId: string,
  ): Promise<void> {
    instance.status = decision;
    instance.completedAt = new Date();

    await Promise.all([
      this.instanceRepo.save(instance),
      this.notifySubmitter({
        submitterId: instance.submitterId,
        tenantId,
        instanceId,
        decision,
        businessType: instance.businessType,
      }),
    ]);

    this.eventEmitter.emit('approval.completed', {
      decision,
      businessType: instance.businessType,
      businessId: instance.businessId,
      tenantId,
      instanceId,
    });
  }

  private getApproverForStep(instance: ApprovalInstance, step: number): string | null {
    if (step === 1) return instance.step1ApproverId;
    if (step === 2) return instance.step2ApproverId;
    if (step === 3) return instance.step3ApproverId;
    return null;
  }

  private async notifyApprover(opts: {
    approverId: string;
    tenantId: string;
    instanceId: string;
    step: number;
    businessType: string;
  }): Promise<void> {
    try {
      await this.notificationService.create({
        userId: opts.approverId,
        tenantId: opts.tenantId,
        type: NotificationType.APPROVAL_REQUESTED,
        title: '您有待审批的申请',
        content: `有一条 ${opts.businessType} 申请需要您在第 ${opts.step} 步进行审批`,
        metadata: { instanceId: opts.instanceId, step: opts.step, businessType: opts.businessType },
      });
    } catch (err) {
      this.logger.warn(`Failed to notify approver ${opts.approverId}: ${(err as Error).message}`);
    }
  }

  private async notifySubmitter(opts: {
    submitterId: string;
    tenantId: string;
    instanceId: string;
    decision: string;
    businessType: string;
  }): Promise<void> {
    try {
      const isApproved = opts.decision === 'approved';
      await this.notificationService.create({
        userId: opts.submitterId,
        tenantId: opts.tenantId,
        type: isApproved ? NotificationType.APPROVAL_COMPLETED : NotificationType.APPROVAL_REJECTED,
        title: isApproved ? '您的申请已通过' : `您的申请已${opts.decision === 'returned' ? '退回' : '被拒绝'}`,
        content: `您提交的 ${opts.businessType} 申请审批结果：${opts.decision}`,
        metadata: { instanceId: opts.instanceId, decision: opts.decision, businessType: opts.businessType },
      });
    } catch (err) {
      this.logger.warn(`Failed to notify submitter ${opts.submitterId}: ${(err as Error).message}`);
    }
  }
}
