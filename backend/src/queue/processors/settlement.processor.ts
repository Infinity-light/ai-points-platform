import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue.constants';

export const SETTLEMENT_JOB_NAMES = {
  RUN_SETTLEMENT: 'run-settlement',
  RECALCULATE_ANNEALING: 'recalculate-annealing',
} as const;

export interface SettlementJobData {
  projectId: string;
  settlementRound: number;
}

export interface AnnealingJobData {
  projectId: string;
  currentRound: number;
}

@Processor(QUEUE_NAMES.SETTLEMENT)
export class SettlementProcessor {
  private readonly logger = new Logger(SettlementProcessor.name);

  @Process(SETTLEMENT_JOB_NAMES.RUN_SETTLEMENT)
  async handleRunSettlement(job: Job<SettlementJobData>): Promise<void> {
    this.logger.log(`Running settlement for project: ${job.data.projectId}, round: ${job.data.settlementRound}`);
    // 结算逻辑将在 T24（Settlement 模块）中实现
  }

  @Process(SETTLEMENT_JOB_NAMES.RECALCULATE_ANNEALING)
  async handleRecalculateAnnealing(job: Job<AnnealingJobData>): Promise<void> {
    this.logger.log(`Recalculating annealing for project: ${job.data.projectId}`);
    // 退火重算逻辑将在 T24（Settlement 模块）中实现
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Settlement job ${job.id} failed: ${error.message}`, error.stack);
  }
}
