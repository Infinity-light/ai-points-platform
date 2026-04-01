import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditFilters {
  action?: string;
  resource?: string;
  actorId?: string;
}

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export interface RecordAuditOptions {
  tenantId: string;
  actorId: string;
  actorName: string;
  action: string;
  resource: string;
  resourceId?: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async record(options: RecordAuditOptions): Promise<void> {
    const log = this.auditLogRepo.create({
      tenantId: options.tenantId,
      actorId: options.actorId,
      actorName: options.actorName,
      action: options.action,
      resource: options.resource,
      resourceId: options.resourceId ?? null,
      previousData: options.previousData ?? null,
      newData: options.newData ?? null,
      ipAddress: options.ipAddress ?? null,
    });

    await this.auditLogRepo.save(log);
  }

  async list(
    tenantId: string,
    filters: AuditFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedAuditLogs> {
    const qb = this.auditLogRepo
      .createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId })
      .orderBy('log.createdAt', 'DESC');

    if (filters.action) {
      qb.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.resource) {
      qb.andWhere('log.resource = :resource', { resource: filters.resource });
    }
    if (filters.actorId) {
      qb.andWhere('log.actorId = :actorId', { actorId: filters.actorId });
    }

    const offset = (page - 1) * limit;
    qb.skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async getByResource(
    tenantId: string,
    resource: string,
    resourceId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { tenantId, resource, resourceId },
      order: { createdAt: 'DESC' },
    });
  }
}
