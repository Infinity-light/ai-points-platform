import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FeishuBitableBinding, BitableFieldMapping } from './entities/feishu-bitable-binding.entity';
import { FeishuBitableRecord } from './entities/feishu-bitable-record.entity';
import { FeishuClientService } from './feishu-client.service';
import { FeishuConfigService } from './feishu-config.service';
import { Task } from '../task/entities/task.entity';
import { TaskStatus } from '../task/enums/task-status.enum';

@Injectable()
export class FeishuBitableSyncService {
  private readonly logger = new Logger(FeishuBitableSyncService.name);

  constructor(
    @InjectRepository(FeishuBitableBinding)
    private readonly bindingRepo: Repository<FeishuBitableBinding>,
    @InjectRepository(FeishuBitableRecord)
    private readonly recordRepo: Repository<FeishuBitableRecord>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly feishuClientService: FeishuClientService,
    private readonly feishuConfigService: FeishuConfigService,
  ) {}

  // ─── Binding Management ──────────────────────────────────────────────────────

  async getBinding(projectId: string, tenantId: string): Promise<FeishuBitableBinding | null> {
    return this.bindingRepo.findOne({ where: { projectId, tenantId } });
  }

  async saveBinding(
    tenantId: string,
    projectId: string,
    data: {
      appToken: string;
      tableId: string;
      fieldMapping: BitableFieldMapping;
      writebackFieldId?: string | null;
    },
  ): Promise<FeishuBitableBinding> {
    const existing = await this.bindingRepo.findOne({ where: { projectId, tenantId } });

    if (existing) {
      existing.appToken = data.appToken;
      existing.tableId = data.tableId;
      existing.fieldMapping = data.fieldMapping;
      existing.writebackFieldId = data.writebackFieldId ?? null;
      existing.syncStatus = 'idle';
      existing.lastSyncError = null;
      return this.bindingRepo.save(existing);
    }

    const binding = this.bindingRepo.create({
      tenantId,
      projectId,
      appToken: data.appToken,
      tableId: data.tableId,
      fieldMapping: data.fieldMapping,
      writebackFieldId: data.writebackFieldId ?? null,
      syncStatus: 'idle',
    });
    return this.bindingRepo.save(binding);
  }

  async deleteBinding(projectId: string, tenantId: string): Promise<void> {
    const binding = await this.bindingRepo.findOne({ where: { projectId, tenantId } });
    if (binding) {
      // Delete associated records
      await this.recordRepo.delete({ bindingId: binding.id });
      await this.bindingRepo.remove(binding);
    }
  }

  // ─── Auto-create Bitable for Project ─────────────────────────────────────────

  async createBitableForProject(
    projectId: string,
    tenantId: string,
    projectName: string,
  ): Promise<FeishuBitableBinding | null> {
    // 1. Check if tenant has Feishu configured and enabled
    const config = await this.feishuConfigService.getConfig(tenantId);
    if (!config || !config.enabled) {
      this.logger.debug(`租户 ${tenantId} 未配置飞书，跳过自动创建 Bitable`);
      return null;
    }

    // 2. Check if binding already exists
    const existing = await this.bindingRepo.findOne({ where: { projectId, tenantId } });
    if (existing) {
      this.logger.debug(`项目 ${projectId} 已有 Bitable 绑定，跳过`);
      return existing;
    }

    // 3. Get SDK client
    const client = await this.feishuClientService.getClient(tenantId);

    // 4. Create a new Bitable app
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createRes = await (client as any).bitable.app.create({
      data: { name: projectName, folder_token: '' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appToken: string = (createRes as any)?.data?.app?.app_token ?? '';
    if (!appToken) {
      this.logger.error(`为项目 ${projectId} 创建 Bitable 应用失败：响应中无 app_token`);
      return null;
    }
    this.logger.log(`为项目 ${projectId} 创建 Bitable 应用: appToken=${appToken}`);

    // 5. Get the default table that was created with the app
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tablesRes = await (client as any).bitable.appTable.list({
      path: { app_token: appToken },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tables: any[] = tablesRes?.data?.items ?? [];
    let tableId: string = tables[0]?.table_id ?? '';
    if (!tableId) {
      // Create a table if none exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newTableRes = await (client as any).bitable.appTable.create({
        path: { app_token: appToken },
        data: { table: { name: '任务列表' } },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tableId = (newTableRes as any)?.data?.table_id ?? '';
    }
    if (!tableId) {
      this.logger.error(`为项目 ${projectId} 创建 Bitable 数据表失败`);
      return null;
    }
    this.logger.log(`Bitable 数据表 ID: tableId=${tableId}`);

    // 6. Create standard fields
    const standardFields = [
      { field_name: '工作任务', type: 1 },
      { field_name: '执行人', type: 1 },
      {
        field_name: '状态',
        type: 3,
        property: {
          options: [
            { name: '待认领' },
            { name: '进行中' },
            { name: '已提交' },
            { name: 'AI评审中' },
            { name: '待复审' },
            { name: '已结算' },
            { name: '已取消' },
          ],
        },
      },
      {
        field_name: '优先级',
        type: 3,
        property: { options: [{ name: '低' }, { name: '中' }, { name: '高' }] },
      },
      { field_name: '截止日期', type: 5 },
      { field_name: '工作成果说明', type: 1 },
      {
        field_name: '事项类型',
        type: 3,
        property: {
          options: [{ name: '探索类' }, { name: 'AI执行类' }, { name: '纯人工类' }],
        },
      },
      { field_name: 'AI评分', type: 1 },
      { field_name: '平台最终工分', type: 2 },
      { field_name: '创建时间', type: 5 },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldMapping: BitableFieldMapping = {};
    let writebackFieldId: string | null = null;

    for (const fieldDef of standardFields) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fieldRes = await (client as any).bitable.appTableField.create({
          path: { app_token: appToken, table_id: tableId },
          data: fieldDef,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fieldId: string = (fieldRes as any)?.data?.field?.field_id ?? '';
        if (!fieldId) continue;

        // Map known fields
        if (fieldDef.field_name === '工作任务') fieldMapping.title = fieldId;
        else if (fieldDef.field_name === '执行人') fieldMapping.assignees = fieldId;
        else if (fieldDef.field_name === '状态') fieldMapping.status = fieldId;
        else if (fieldDef.field_name === '工作成果说明') fieldMapping.description = fieldId;
        else if (fieldDef.field_name === '平台最终工分') writebackFieldId = fieldId;

        this.logger.debug(`创建 Bitable 字段: ${fieldDef.field_name} → fieldId=${fieldId}`);
      } catch (fieldErr) {
        this.logger.warn(`创建 Bitable 字段失败: ${fieldDef.field_name}, ${String(fieldErr)}`);
      }
    }

    // 7. Save binding
    const binding = await this.saveBinding(tenantId, projectId, {
      appToken,
      tableId,
      fieldMapping,
      writebackFieldId,
    });

    this.logger.log(
      `项目 ${projectId} Bitable 绑定创建成功: appToken=${appToken}, tableId=${tableId}`,
    );
    return binding;
  }

  // ─── Platform → Feishu Task Sync ─────────────────────────────────────────────

  async syncTaskToFeishu(task: Task, tenantId: string): Promise<void> {
    const binding = await this.getBinding(task.projectId, tenantId);
    if (!binding) return;

    const client = await this.feishuClientService.getClient(tenantId);
    const fields = this.mapTaskToFeishuFields(task, binding.fieldMapping);

    if (task.feishuRecordId) {
      // Update existing record
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any).bitable.appTableRecord.update({
          path: {
            app_token: binding.appToken,
            table_id: binding.tableId,
            record_id: task.feishuRecordId,
          },
          data: { fields },
        });
        this.logger.debug(
          `Bitable 记录已更新: taskId=${task.id}, recordId=${task.feishuRecordId}`,
        );
      } catch (err) {
        this.logger.warn(`更新 Bitable 记录失败: taskId=${task.id}, ${String(err)}`);
      }
    } else {
      // Create new record
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (client as any).bitable.appTableRecord.create({
          path: { app_token: binding.appToken, table_id: binding.tableId },
          data: { fields },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recordId: string = (res as any)?.data?.record?.record_id ?? '';
        if (recordId) {
          await this.taskRepo.update(task.id, { feishuRecordId: recordId });
          await this.recordRepo.save(
            this.recordRepo.create({
              bindingId: binding.id,
              feishuRecordId: recordId,
              taskId: task.id,
              lastSyncAt: new Date(),
            }),
          );
          this.logger.debug(
            `Bitable 记录已创建: taskId=${task.id}, recordId=${recordId}`,
          );
        }
      } catch (err) {
        this.logger.warn(`创建 Bitable 记录失败: taskId=${task.id}, ${String(err)}`);
      }
    }
  }

  private mapTaskToFeishuFields(
    task: Task,
    mapping: BitableFieldMapping,
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    if (mapping.title) {
      fields[mapping.title] = task.title;
    }
    if (mapping.description) {
      fields[mapping.description] = task.description ?? '';
    }
    if (mapping.status) {
      const statusMap: Record<string, string> = {
        open: '待认领',
        claimed: '进行中',
        submitted: '已提交',
        ai_reviewing: 'AI评审中',
        pending_review: '待复审',
        settled: '已结算',
        cancelled: '已取消',
      };
      fields[mapping.status] = statusMap[task.status] ?? task.status;
    }

    return fields;
  }

  // ─── Feishu API ──────────────────────────────────────────────────────────────

  async fetchTableFields(
    tenantId: string,
    appToken: string,
    tableId: string,
  ): Promise<Array<{ fieldId: string; fieldName: string; type: number }>> {
    const client = await this.feishuClientService.getClient(tenantId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (client as any).bitable.appTableField.list({
      path: { app_token: appToken, table_id: tableId },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = res?.data?.items ?? [];
    return items.map((f) => ({
      fieldId: f.field_id as string,
      fieldName: f.field_name as string,
      type: f.type as number,
    }));
  }

  // ─── Full Sync ───────────────────────────────────────────────────────────────

  async fullSync(
    bindingId: string,
    tenantId: string,
  ): Promise<{ created: number; updated: number; total: number }> {
    const binding = await this.bindingRepo.findOne({ where: { id: bindingId } });
    if (!binding) {
      throw new NotFoundException(`Bitable binding ${bindingId} 不存在`);
    }

    // Mark as syncing
    binding.syncStatus = 'syncing';
    binding.lastSyncError = null;
    await this.bindingRepo.save(binding);

    let created = 0;
    let updated = 0;
    let total = 0;

    try {
      const client = await this.feishuClientService.getClient(tenantId);

      // Paginate through all records
      let pageToken: string | undefined;
      do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (client as any).bitable.appTableRecord.list({
          path: { app_token: binding.appToken, table_id: binding.tableId },
          params: { page_size: 100, ...(pageToken ? { page_token: pageToken } : {}) },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const records: any[] = res?.data?.items ?? [];
        pageToken = res?.data?.page_token as string | undefined;

        for (const record of records) {
          total++;
          const recordId: string = record.record_id as string;
          const fields = record.fields ?? {};

          const result = await this.upsertRecordAsTask(binding, tenantId, recordId, fields);
          if (result === 'created') created++;
          else updated++;
        }
      } while (pageToken);

      // Mark idle
      binding.syncStatus = 'idle';
      binding.lastSyncAt = new Date();
      binding.lastSyncError = null;
      await this.bindingRepo.save(binding);

      this.logger.log(
        `Bitable 全量同步完成: bindingId=${bindingId}, created=${created}, updated=${updated}, total=${total}`,
      );
    } catch (err) {
      binding.syncStatus = 'error';
      binding.lastSyncError = String(err);
      await this.bindingRepo.save(binding);
      this.logger.error(`Bitable 全量同步失败: bindingId=${bindingId}, ${String(err)}`);
      throw err;
    }

    return { created, updated, total };
  }

  // ─── Single Record Sync (for webhook incremental updates) ───────────────────

  async syncSingleRecord(bindingId: string, tenantId: string, recordId: string): Promise<void> {
    const binding = await this.bindingRepo.findOne({ where: { id: bindingId } });
    if (!binding) {
      this.logger.warn(`syncSingleRecord: binding ${bindingId} 不存在，跳过`);
      return;
    }

    try {
      const client = await this.feishuClientService.getClient(tenantId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (client as any).bitable.appTableRecord.get({
        path: { app_token: binding.appToken, table_id: binding.tableId, record_id: recordId },
      });

      const fields = res?.data?.record?.fields ?? {};
      await this.upsertRecordAsTask(binding, tenantId, recordId, fields);

      binding.lastSyncAt = new Date();
      await this.bindingRepo.save(binding);
    } catch (err) {
      this.logger.error(`Bitable 单记录同步失败: recordId=${recordId}, ${String(err)}`);
    }
  }

  // ─── Lookup by AppToken + TableId (for webhook listener) ────────────────────

  async syncSingleRecordByTable(
    tenantId: string,
    appToken: string,
    tableId: string,
    recordId: string,
  ): Promise<void> {
    const binding = await this.bindingRepo.findOne({
      where: { tenantId, appToken, tableId },
    });
    if (!binding) {
      this.logger.warn(
        `syncSingleRecordByTable: 未找到 binding for appToken=${appToken}, tableId=${tableId}`,
      );
      return;
    }
    await this.syncSingleRecord(binding.id, tenantId, recordId);
  }

  // ─── Writeback Points ────────────────────────────────────────────────────────

  async writebackPoints(
    projectId: string,
    tenantId: string,
    settledTaskIds: string[],
  ): Promise<void> {
    if (!settledTaskIds.length) return;

    const binding = await this.bindingRepo.findOne({ where: { projectId, tenantId } });
    if (!binding || !binding.writebackFieldId) {
      this.logger.debug(`项目 ${projectId} 无 Bitable 绑定或未配置回写字段，跳过`);
      return;
    }

    const client = await this.feishuClientService.getClient(tenantId);

    // Load tasks with feishuRecordId
    const tasks = await this.taskRepo.find({
      where: { id: In(settledTaskIds), tenantId },
    });

    let writebackCount = 0;
    for (const task of tasks) {
      if (!task.feishuRecordId) continue;
      const finalPoints = task.metadata?.finalPoints;
      if (finalPoints === undefined || finalPoints === null) continue;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any).bitable.appTableRecord.update({
          path: {
            app_token: binding.appToken,
            table_id: binding.tableId,
            record_id: task.feishuRecordId,
          },
          data: {
            fields: { [binding.writebackFieldId]: finalPoints },
          },
        });
        writebackCount++;
      } catch (err) {
        this.logger.warn(
          `回写工分失败: taskId=${task.id}, recordId=${task.feishuRecordId}, ${String(err)}`,
        );
      }
    }

    this.logger.log(
      `Bitable 工分回写完成: projectId=${projectId}, writebackCount=${writebackCount}/${tasks.length}`,
    );
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async upsertRecordAsTask(
    binding: FeishuBitableBinding,
    tenantId: string,
    recordId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: Record<string, any>,
  ): Promise<'created' | 'updated'> {
    const { fieldMapping, projectId } = binding;

    // Extract title from field mapping
    const titleFieldId = fieldMapping.title;
    let title = titleFieldId ? this.extractTextValue(fields[titleFieldId]) : '';
    if (!title) title = `Bitable 记录 ${recordId}`;

    // Extract description
    const descriptionFieldId = fieldMapping.description;
    const description = descriptionFieldId
      ? this.extractTextValue(fields[descriptionFieldId])
      : null;

    // Extract assignee (Feishu person field is an array of objects with id/name/en_name)
    const assigneesFieldId = fieldMapping.assignees;
    let assigneeName: string | null = null;
    if (assigneesFieldId && fields[assigneesFieldId]) {
      const persons: Array<{ id?: string; name?: string }> = Array.isArray(fields[assigneesFieldId])
        ? fields[assigneesFieldId]
        : [];
      if (persons.length > 0) {
        assigneeName = persons[0].name ?? null;
      }
    }

    // Find or create FeishuBitableRecord
    let bitableRecord = await this.recordRepo.findOne({
      where: { bindingId: binding.id, feishuRecordId: recordId },
    });

    let isNew = false;
    if (!bitableRecord) {
      bitableRecord = this.recordRepo.create({
        bindingId: binding.id,
        feishuRecordId: recordId,
        taskId: null,
        lastSyncAt: new Date(),
      });
      isNew = true;
    }

    // Find or create Task
    let task: Task | null = null;

    if (bitableRecord.taskId) {
      task = await this.taskRepo.findOne({ where: { id: bitableRecord.taskId, tenantId } });
    }

    if (!task) {
      // Also try to find by feishuRecordId on the task directly
      task = await this.taskRepo.findOne({ where: { feishuRecordId: recordId, tenantId } });
    }

    if (task) {
      // Update existing task
      task.title = title;
      if (description !== null) task.description = description;
      task.feishuRecordId = recordId;
      // Store assignee name in metadata if no direct userId mapping available
      if (assigneeName) {
        task.metadata = { ...task.metadata, feishuAssigneeName: assigneeName };
      }
      await this.taskRepo.save(task);
    } else {
      // Create new task — use a system placeholder for createdBy
      // The task is imported from Feishu so we use a sentinel value
      const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
      task = this.taskRepo.create({
        tenantId,
        projectId,
        createdBy: SYSTEM_USER_ID,
        title,
        description: description ?? null,
        status: TaskStatus.OPEN,
        feishuRecordId: recordId,
        metadata: assigneeName ? { feishuAssigneeName: assigneeName } : {},
      });
      task = await this.taskRepo.save(task);
    }

    // Update bitable record link
    bitableRecord.taskId = task.id;
    bitableRecord.lastSyncAt = new Date();
    await this.recordRepo.save(bitableRecord);

    return isNew ? 'created' : 'updated';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractTextValue(fieldValue: any): string {
    if (!fieldValue) return '';
    // Plain string
    if (typeof fieldValue === 'string') return fieldValue;
    // Feishu text field: array of segments [{ type: 'text', text: '...' }]
    if (Array.isArray(fieldValue)) {
      return fieldValue
        .map((seg) => (typeof seg === 'object' && seg !== null ? (seg.text ?? '') : String(seg)))
        .join('');
    }
    return String(fieldValue);
  }
}
