import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  async create(data: {
    userId: string;
    tenantId: string;
    type: NotificationType;
    title: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    const notif = this.notifRepo.create(data);
    return this.notifRepo.save(notif);
  }

  async findByUser(userId: string, tenantId: string): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { userId, tenantId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    return this.notifRepo.count({ where: { userId, tenantId, isRead: false } });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notifRepo.update({ id, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string, tenantId: string): Promise<void> {
    await this.notifRepo.update({ userId, tenantId, isRead: false }, { isRead: true });
  }
}
