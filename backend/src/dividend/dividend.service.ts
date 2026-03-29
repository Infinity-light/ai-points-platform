import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dividend, DividendStatus, DividendDetails } from './entities/dividend.entity';

@Injectable()
export class DividendService {
  constructor(
    @InjectRepository(Dividend)
    private readonly dividendRepository: Repository<Dividend>,
  ) {}

  async createDraft(options: {
    tenantId: string;
    projectId: string;
    settlementId: string;
    roundNumber: number;
    memberActivePoints: Map<string, number>;
    userNames: Map<string, string>;
  }): Promise<Dividend> {
    const { tenantId, projectId, settlementId, roundNumber, memberActivePoints, userNames } = options;

    let totalActivePoints = 0;
    for (const pts of memberActivePoints.values()) {
      totalActivePoints += pts;
    }

    const details: DividendDetails = {};
    for (const [userId, activePoints] of memberActivePoints.entries()) {
      const ratio = totalActivePoints > 0 ? activePoints / totalActivePoints : 0;
      details[userId] = {
        userName: userNames.get(userId) ?? '',
        activePoints,
        ratio,
        amount: null,
      };
    }

    const dividend = this.dividendRepository.create({
      tenantId,
      projectId,
      settlementId,
      roundNumber,
      totalAmount: null,
      totalActivePoints,
      details,
      status: DividendStatus.DRAFT,
    });

    return this.dividendRepository.save(dividend);
  }

  async findForProject(tenantId: string, projectId: string): Promise<Dividend[]> {
    return this.dividendRepository.find({
      where: { tenantId, projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Dividend> {
    const dividend = await this.dividendRepository.findOne({ where: { id, tenantId } });
    if (!dividend) throw new NotFoundException(`分红记录 ${id} 不存在`);
    return dividend;
  }

  async fillAmount(
    id: string,
    tenantId: string,
    totalAmount: number,
  ): Promise<Dividend> {
    const dividend = await this.findOne(id, tenantId);

    if (dividend.status !== DividendStatus.DRAFT) {
      throw new BadRequestException('只有草稿状态的分红可以填写金额');
    }

    const updatedDetails: DividendDetails = {};
    for (const [userId, entry] of Object.entries(dividend.details)) {
      updatedDetails[userId] = {
        ...entry,
        amount: Math.round(totalAmount * entry.ratio * 100) / 100,
      };
    }

    dividend.totalAmount = totalAmount;
    dividend.details = updatedDetails;
    dividend.status = DividendStatus.PENDING_APPROVAL;

    return this.dividendRepository.save(dividend);
  }

  async approve(
    id: string,
    tenantId: string,
    approvedBy: string,
  ): Promise<Dividend> {
    const dividend = await this.findOne(id, tenantId);

    if (dividend.status !== DividendStatus.PENDING_APPROVAL) {
      throw new BadRequestException('只有待审批状态的分红可以审批');
    }

    dividend.status = DividendStatus.APPROVED;
    dividend.approvedBy = approvedBy;

    return this.dividendRepository.save(dividend);
  }

  async reject(id: string, tenantId: string): Promise<Dividend> {
    const dividend = await this.findOne(id, tenantId);

    if (dividend.status !== DividendStatus.PENDING_APPROVAL) {
      throw new BadRequestException('只有待审批状态的分红可以拒绝');
    }

    dividend.status = DividendStatus.REJECTED;

    return this.dividendRepository.save(dividend);
  }
}
