import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job, Queue } from 'bull';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { Asset } from './entities/asset.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';

const CHECK_EXPIRY_JOB = 'check-expiry';
const EXPIRY_CRON = '0 9 * * *'; // 09:00 daily
const EXPIRY_THRESHOLDS_DAYS = [30, 7, 3, 1];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
@Processor(QUEUE_NAMES.ASSET_EXPIRY)
export class AssetExpiryProcessor implements OnModuleInit {
  private readonly logger = new Logger(AssetExpiryProcessor.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.ASSET_EXPIRY)
    private readonly expiryQueue: Queue,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      // Remove existing repeatable jobs to avoid duplicates on restart
      const existing = await this.expiryQueue.getRepeatableJobs();
      for (const job of existing) {
        if (job.name === CHECK_EXPIRY_JOB) {
          await this.expiryQueue.removeRepeatableByKey(job.key);
        }
      }

      await this.expiryQueue.add(
        CHECK_EXPIRY_JOB,
        {},
        {
          repeat: { cron: EXPIRY_CRON },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log('Asset expiry check cron job registered (09:00 daily)');
    } catch (err) {
      this.logger.error(`Failed to register asset expiry cron: ${(err as Error).message}`);
    }
  }

  @Process(CHECK_EXPIRY_JOB)
  async handleCheckExpiry(_job: Job): Promise<void> {
    this.logger.log('Running asset expiry check');

    try {
      const now = new Date();

      // Auto-transition expired virtual assets
      const expiredAssets = await this.assetRepo
        .createQueryBuilder('asset')
        .where('asset."assetType" = :type', { type: 'virtual' })
        .andWhere('asset."expiresAt" <= :now', { now })
        .andWhere('asset.status NOT IN (:...terminal)', {
          terminal: ['expired', 'decommissioned', 'disposed'],
        })
        .getMany();

      if (expiredAssets.length > 0) {
        for (const asset of expiredAssets) {
          asset.status = 'expired';
        }
        await this.assetRepo.save(expiredAssets);
        this.logger.log(
          `Transitioned to expired: ${expiredAssets.map((a) => a.assetCode).join(', ')}`,
        );
      }

      // Auto-transition assets expiring within 30 days to 'expiring_soon'
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * MS_PER_DAY);
      const expiringSoonAssets = await this.assetRepo
        .createQueryBuilder('asset')
        .where('asset."assetType" = :type', { type: 'virtual' })
        .andWhere('asset."expiresAt" > :now', { now })
        .andWhere('asset."expiresAt" <= :threshold', { threshold: thirtyDaysFromNow })
        .andWhere('asset.status = :status', { status: 'active' })
        .getMany();

      if (expiringSoonAssets.length > 0) {
        for (const asset of expiringSoonAssets) {
          asset.status = 'expiring_soon';
        }
        await this.assetRepo.save(expiringSoonAssets);
      }

      // Send notifications for threshold-based reminders
      await this.sendExpiryReminders(now);

      this.logger.log(
        `Asset expiry check complete: ${expiredAssets.length} expired, ${expiringSoonAssets.length} marked expiring_soon`,
      );
    } catch (err) {
      this.logger.error(`Asset expiry check failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async sendExpiryReminders(now: Date): Promise<void> {
    for (const days of EXPIRY_THRESHOLDS_DAYS) {
      const windowStart = new Date(now.getTime() + days * MS_PER_DAY);
      const windowEnd = new Date(windowStart.getTime() + MS_PER_DAY);

      const assets = await this.assetRepo
        .createQueryBuilder('asset')
        .where('asset."assetType" = :type', { type: 'virtual' })
        .andWhere('asset."expiresAt" >= :start', { start: windowStart })
        .andWhere('asset."expiresAt" < :end', { end: windowEnd })
        .andWhere('asset.status IN (:...statuses)', {
          statuses: ['active', 'expiring_soon'],
        })
        .andWhere('asset."assignedUserId" IS NOT NULL')
        .getMany();

      await Promise.all(
        assets.map((asset) =>
          this.notificationService
            .create({
              userId: asset.assignedUserId!,
              tenantId: asset.tenantId,
              type: NotificationType.ASSET_EXPIRY_REMINDER,
              title: '资产即将到期提醒',
              content: `您负责的资产「${asset.name}」(${asset.assetCode}) 将在 ${days} 天后到期，请及时处理。`,
              metadata: {
                assetId: asset.id,
                assetCode: asset.assetCode,
                expiresAt: asset.expiresAt,
                daysRemaining: days,
              },
            })
            .catch((err: unknown) =>
              this.logger.warn(
                `Failed to send expiry reminder for asset ${asset.id}: ${(err as Error).message}`,
              ),
            ),
        ),
      );
    }
  }
}
