import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as lark from '@larksuiteoapi/node-sdk';
import { FeishuSyncLog, SyncType, SyncStatus } from './entities/feishu-sync-log.entity';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { FeishuClientService } from './feishu-client.service';
import { FeishuConfigService } from './feishu-config.service';
import { DepartmentService } from '../department/department.service';

const EMPLOYEE_ROLE_ID = '00000000-0000-0000-0000-000000000004';
const RESIGNED_ROLE_ID = '00000000-0000-0000-0000-000000000007';

interface FeishuUserInfo {
  open_id?: string;
  union_id?: string;
  name?: string;
  email?: string;
  avatar?: { avatar_72?: string };
  department_ids?: string[];
  job_title?: string;
}

@Injectable()
export class FeishuSyncService {
  private readonly logger = new Logger(FeishuSyncService.name);

  constructor(
    @InjectRepository(FeishuSyncLog)
    private readonly syncLogRepo: Repository<FeishuSyncLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    private readonly feishuClientService: FeishuClientService,
    private readonly feishuConfigService: FeishuConfigService,
    private readonly departmentService: DepartmentService,
  ) {}

  async syncAll(tenantId: string): Promise<FeishuSyncLog> {
    // Create sync log
    const syncLog = await this.syncLogRepo.save(
      this.syncLogRepo.create({
        tenantId,
        type: SyncType.FULL,
        status: SyncStatus.RUNNING,
        stats: {},
      }),
    );

    const stats = {
      newUsers: 0,
      updatedUsers: 0,
      resignedUsers: 0,
      newDepts: 0,
      updatedDepts: 0,
    };

    try {
      const client = await this.feishuClientService.getClient(tenantId);

      // Step 1: Pull all departments
      const feishuDepts: Array<{
        open_department_id?: string;
        name?: string;
        parent_open_department_id?: string;
        order?: string | number;
        member_count?: number;
      }> = [];

      const deptAsyncIter = await client.contact.department.listWithIterator({
        params: { fetch_child: true, department_id_type: 'open_department_id' },
      });

      for await (const page of deptAsyncIter) {
        if (!page) continue;
        if (page.items) {
          feishuDepts.push(...page.items);
        }
      }

      this.logger.log(`飞书部门数量: ${feishuDepts.length}`);

      // Upsert departments
      if (feishuDepts.length > 0) {
        const deptResult = await this.departmentService.upsertBatch(
          tenantId,
          feishuDepts.map((d) => ({
            feishuDeptId: d.open_department_id ?? '',
            name: d.name ?? '',
            parentFeishuDeptId: d.parent_open_department_id || null,
            sortOrder: d.order ? parseInt(String(d.order), 10) : 0,
            memberCount: d.member_count ?? 0,
          })),
        );
        stats.newDepts = deptResult.newDepts;
        stats.updatedDepts = deptResult.updatedDepts;

        // Soft-delete missing departments
        const activeDeptIds = feishuDepts.map((d) => d.open_department_id ?? '').filter(Boolean);
        await this.departmentService.softDeleteMissing(tenantId, activeDeptIds);
      }

      // Step 2: Pull all users
      const feishuUsers: FeishuUserInfo[] = [];

      const userAsyncIter = await client.contact.user.listWithIterator({
        params: {
          department_id: '0',
          department_id_type: 'open_department_id',
          user_id_type: 'open_id',
        },
      });

      for await (const page of userAsyncIter) {
        if (!page) continue;
        if (page.items) {
          feishuUsers.push(...(page.items as FeishuUserInfo[]));
        }
      }

      this.logger.log(`飞书用户数量: ${feishuUsers.length}`);

      // Track openIds seen in Feishu
      const feishuOpenIds = new Set<string>();

      // Step 3: Upsert users
      for (const fu of feishuUsers) {
        if (!fu.open_id) continue;
        feishuOpenIds.add(fu.open_id);

        try {
          await this.upsertFeishuUser(tenantId, fu, stats);
        } catch (err) {
          this.logger.warn(`用户同步失败 (openId=${fu.open_id}): ${String(err)}`);
        }
      }

      // Step 4: Detect resigned users
      const platformFeishuUsers = await this.userRepo
        .createQueryBuilder('user')
        .where('user.tenantId = :tenantId', { tenantId })
        .andWhere('user.feishuOpenId IS NOT NULL')
        .getMany();

      for (const pu of platformFeishuUsers) {
        if (pu.feishuOpenId && !feishuOpenIds.has(pu.feishuOpenId)) {
          // Not found in Feishu → resigned
          await this.assignRole(pu.id, RESIGNED_ROLE_ID);
          stats.resignedUsers++;
          this.logger.log(`标记离职用户: ${pu.email} (openId=${pu.feishuOpenId})`);
        }
      }

      // Done
      syncLog.status = SyncStatus.SUCCESS;
      syncLog.stats = stats;
      syncLog.completedAt = new Date();
    } catch (err) {
      syncLog.status = SyncStatus.FAILED;
      syncLog.error = String(err);
      syncLog.completedAt = new Date();
      this.logger.error(`飞书全量同步失败: ${String(err)}`);
    }

    return this.syncLogRepo.save(syncLog);
  }

  async getSyncLogs(tenantId: string, page: number, limit: number): Promise<{ items: FeishuSyncLog[]; total: number }> {
    const [items, total] = await this.syncLogRepo.findAndCount({
      where: { tenantId },
      order: { startedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async processWebhookEvent(tenantId: string, event: Record<string, unknown>): Promise<void> {
    const type = (event as { type?: string }).type;
    const header = (event as { header?: { event_type?: string } }).header;
    const eventType = header?.event_type ?? type;

    this.logger.log(`处理飞书 Webhook 事件: ${eventType}`);

    const log = await this.syncLogRepo.save(
      this.syncLogRepo.create({
        tenantId,
        type: SyncType.INCREMENTAL,
        status: SyncStatus.RUNNING,
        stats: {},
      }),
    );

    const stats = { newUsers: 0, updatedUsers: 0, resignedUsers: 0, newDepts: 0, updatedDepts: 0 };

    try {
      if (eventType === 'contact.user.created_v3' || eventType === 'contact.user.updated_v3') {
        const userData = (event as { event?: { object?: FeishuUserInfo } }).event?.object;
        if (userData?.open_id) {
          await this.upsertFeishuUser(tenantId, userData, stats);
        }
      } else if (eventType === 'contact.user.deleted_v3') {
        const openId = (event as { event?: { object?: { open_id?: string } } }).event?.object?.open_id;
        if (openId) {
          const user = await this.userRepo.findOne({ where: { tenantId, feishuOpenId: openId } });
          if (user) {
            await this.assignRole(user.id, RESIGNED_ROLE_ID);
            stats.resignedUsers++;
          }
        }
      } else if (eventType?.startsWith('contact.department.')) {
        // Trigger partial sync for this department
        const deptData = (event as { event?: { object?: Record<string, unknown> } }).event?.object;
        if (deptData && deptData['open_department_id']) {
          const deptResult = await this.departmentService.upsertBatch(tenantId, [{
            feishuDeptId: deptData['open_department_id'] as string,
            name: (deptData['name'] as string) ?? '',
            parentFeishuDeptId: (deptData['parent_open_department_id'] as string) || null,
          }]);
          stats.newDepts = deptResult.newDepts;
          stats.updatedDepts = deptResult.updatedDepts;
        }
      }

      log.status = SyncStatus.SUCCESS;
      log.stats = stats;
      log.completedAt = new Date();
    } catch (err) {
      log.status = SyncStatus.FAILED;
      log.error = String(err);
      log.completedAt = new Date();
    }

    await this.syncLogRepo.save(log);
  }

  private async upsertFeishuUser(
    tenantId: string,
    fu: FeishuUserInfo,
    stats: { newUsers: number; updatedUsers: number },
  ): Promise<void> {
    if (!fu.open_id) return;

    // Try match by feishuOpenId
    let user = await this.userRepo.findOne({ where: { tenantId, feishuOpenId: fu.open_id } });

    if (user) {
      // Update existing user
      user.feishuUnionId = fu.union_id ?? user.feishuUnionId;
      user.avatarUrl = fu.avatar?.avatar_72 ?? user.avatarUrl;
      if (fu.name) user.name = fu.name;
      await this.userRepo.save(user);
      stats.updatedUsers++;
      return;
    }

    // Try match by email
    if (fu.email) {
      user = await this.userRepo
        .createQueryBuilder('user')
        .where('user.tenantId = :tenantId', { tenantId })
        .andWhere('LOWER(user.email) = LOWER(:email)', { email: fu.email })
        .getOne();

      if (user) {
        user.feishuOpenId = fu.open_id;
        user.feishuUnionId = fu.union_id ?? null;
        user.avatarUrl = fu.avatar?.avatar_72 ?? null;
        await this.userRepo.save(user);
        stats.updatedUsers++;
        return;
      }
    }

    // Create new user
    if (!fu.email && !fu.name) {
      this.logger.warn(`飞书用户无邮箱和姓名，跳过 (openId=${fu.open_id})`);
      return;
    }

    const newUser = this.userRepo.create({
      tenantId,
      email: fu.email ?? `${fu.open_id}@feishu.local`,
      passwordHash: '', // No password for Feishu users
      name: fu.name ?? fu.open_id,
      feishuOpenId: fu.open_id,
      feishuUnionId: fu.union_id ?? null,
      avatarUrl: fu.avatar?.avatar_72 ?? null,
      isEmailVerified: true,
    });
    const savedUser = await this.userRepo.save(newUser);

    // Assign role via mapping
    const jobTitle = fu.job_title ?? '';
    const mapping = jobTitle
      ? await this.feishuConfigService.getMappingByFeishuRole(tenantId, jobTitle)
      : null;

    const roleId = mapping?.platformRoleId ?? EMPLOYEE_ROLE_ID;
    await this.assignRole(savedUser.id, roleId);
    stats.newUsers++;
  }

  private async assignRole(userId: string, roleId: string): Promise<void> {
    const existing = await this.userRoleRepo.findOne({ where: { userId } });
    if (existing) {
      existing.roleId = roleId;
      await this.userRoleRepo.save(existing);
    } else {
      await this.userRoleRepo.save(this.userRoleRepo.create({ userId, roleId }));
    }
  }
}
