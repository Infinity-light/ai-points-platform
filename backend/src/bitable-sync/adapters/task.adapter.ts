import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../task/entities/task.entity';
import { TaskStatus } from '../../task/enums/task-status.enum';
import { BitableSyncAdapter, FieldDefinition } from '../bitable-sync-registry.service';
import { BitableFieldMapping } from '../../feishu/entities/feishu-bitable-binding.entity';

const STATUS_TO_FEISHU: Record<string, string> = {
  open: '待认领',
  claimed: '进行中',
  submitted: '已提交',
  ai_reviewing: 'AI评审中',
  pending_review: '待复审',
  pending_vote: '待投票',
  settled: '已结算',
  cancelled: '已取消',
};

const FEISHU_TO_STATUS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_TO_FEISHU).map(([k, v]) => [v, k]),
);

const PRIORITY_TO_FEISHU: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

const FEISHU_TO_PRIORITY: Record<string, string> = {
  '低': 'low',
  '中': 'medium',
  '高': 'high',
};

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class TaskBitableAdapter implements BitableSyncAdapter {
  entityType = 'task';
  defaultSyncDirection = 'bidirectional' as const;

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  getDefaultFieldMappings(): Record<string, FieldDefinition> {
    return {
      title: { feishuFieldName: '工作任务', feishuFieldType: 1, platformField: 'title' },
      assignees: { feishuFieldName: '执行人', feishuFieldType: 1, platformField: 'assigneeName' },
      status: { feishuFieldName: '状态', feishuFieldType: 3, platformField: 'status' },
      priority: { feishuFieldName: '优先级', feishuFieldType: 3, platformField: 'priority' },
      dueDate: { feishuFieldName: '截止日期', feishuFieldType: 5, platformField: 'dueDate' },
      description: {
        feishuFieldName: '工作成果说明',
        feishuFieldType: 1,
        platformField: 'description',
      },
      aiScore: { feishuFieldName: 'AI评分', feishuFieldType: 1, platformField: 'aiScore' },
      finalPoints: {
        feishuFieldName: '平台最终工分',
        feishuFieldType: 2,
        platformField: 'finalPoints',
      },
      createdAt: { feishuFieldName: '创建时间', feishuFieldType: 5, platformField: 'createdAt' },
    };
  }

  toFeishuRecord(entity: unknown, fieldMapping: BitableFieldMapping): Record<string, unknown> {
    const task = entity as Task;
    const fields: Record<string, unknown> = {};

    if (fieldMapping.title) {
      fields[fieldMapping.title] = task.title;
    }

    if (fieldMapping.assignees) {
      fields[fieldMapping.assignees] =
        (task.metadata?.feishuAssigneeName as string | undefined) ?? '';
    }

    if (fieldMapping.status) {
      fields[fieldMapping.status] = STATUS_TO_FEISHU[task.status] ?? task.status;
    }

    if (fieldMapping['priority']) {
      const priority = task.metadata?.priority as string | undefined;
      fields[fieldMapping['priority']] = priority ? (PRIORITY_TO_FEISHU[priority] ?? '') : '';
    }

    if (fieldMapping['dueDate']) {
      const deadline = task.metadata?.deadline as string | undefined;
      if (deadline) {
        const d = new Date(deadline);
        if (!isNaN(d.getTime())) {
          fields[fieldMapping['dueDate']] = d.getTime();
        }
      }
    }

    if (fieldMapping.description) {
      fields[fieldMapping.description] = task.description ?? '';
    }

    if (fieldMapping['aiScore'] && task.metadata?.aiScores !== undefined) {
      const scores = task.metadata.aiScores as Record<string, unknown> | undefined;
      fields[fieldMapping['aiScore']] = scores ? JSON.stringify(scores) : '';
    }

    if (
      fieldMapping['finalPoints'] &&
      task.metadata?.finalPoints !== undefined
    ) {
      fields[fieldMapping['finalPoints']] = Number(task.metadata.finalPoints);
    }

    if (fieldMapping['createdAt']) {
      fields[fieldMapping['createdAt']] = task.createdAt.getTime();
    }

    return fields;
  }

  fromFeishuRecord(
    fields: Record<string, unknown>,
    fieldMapping: BitableFieldMapping,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (fieldMapping.title && fields[fieldMapping.title] !== undefined) {
      data['title'] = extractTextValue(fields[fieldMapping.title]);
    }

    if (fieldMapping.status && fields[fieldMapping.status] !== undefined) {
      const rawStatus = extractSelectValue(fields[fieldMapping.status]);
      if (rawStatus && FEISHU_TO_STATUS[rawStatus]) {
        data['status'] = FEISHU_TO_STATUS[rawStatus];
      }
    }

    if (fieldMapping['priority'] && fields[fieldMapping['priority']] !== undefined) {
      const rawPriority = extractSelectValue(fields[fieldMapping['priority']]);
      if (rawPriority && FEISHU_TO_PRIORITY[rawPriority]) {
        data['priority'] = FEISHU_TO_PRIORITY[rawPriority];
      }
    }

    if (fieldMapping['dueDate'] && fields[fieldMapping['dueDate']] !== undefined) {
      const ts = fields[fieldMapping['dueDate']];
      if (typeof ts === 'number') {
        data['deadline'] = new Date(ts).toISOString();
      }
    }

    if (fieldMapping.description && fields[fieldMapping.description] !== undefined) {
      data['description'] = extractTextValue(fields[fieldMapping.description]);
    }

    if (fieldMapping.assignees && fields[fieldMapping.assignees] !== undefined) {
      const persons = fields[fieldMapping.assignees];
      if (Array.isArray(persons) && persons.length > 0) {
        const first = persons[0] as Record<string, unknown>;
        data['feishuAssigneeName'] = (first['name'] as string) ?? '';
      }
    }

    return data;
  }

  async findEntity(tenantId: string, id: string): Promise<Task | null> {
    return this.taskRepo.findOne({ where: { id, tenantId } });
  }

  async findAllEntities(tenantId: string, projectId: string): Promise<Task[]> {
    if (!projectId) return [];
    return this.taskRepo.find({ where: { tenantId, projectId } });
  }

  async upsertFromFeishu(
    tenantId: string,
    projectId: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; isNew: boolean }> {
    const feishuRecordId = data['feishuRecordId'] as string | undefined;

    let task: Task | null = feishuRecordId
      ? await this.taskRepo.findOne({ where: { feishuRecordId, tenantId } })
      : null;

    if (task) {
      if (data['title']) task.title = data['title'] as string;
      if (data['status'] && FEISHU_TO_STATUS[data['status'] as string]) {
        task.status = FEISHU_TO_STATUS[data['status'] as string] as TaskStatus;
      }
      if (data['description'] !== undefined) {
        task.description = (data['description'] as string) || null;
      }

      const metaUpdates: Record<string, unknown> = {};
      if (data['priority']) metaUpdates['priority'] = data['priority'];
      if (data['deadline']) metaUpdates['deadline'] = data['deadline'];
      if (data['feishuAssigneeName']) {
        metaUpdates['feishuAssigneeName'] = data['feishuAssigneeName'];
      }
      if (Object.keys(metaUpdates).length > 0) {
        task.metadata = { ...task.metadata, ...metaUpdates };
      }

      task = await this.taskRepo.save(task);
      return { id: task.id, isNew: false };
    }

    const title = (data['title'] as string | undefined) || 'Bitable导入任务';
    const newMeta: Record<string, unknown> = {};
    if (data['priority']) newMeta['priority'] = data['priority'];
    if (data['deadline']) newMeta['deadline'] = data['deadline'];
    if (data['feishuAssigneeName']) {
      newMeta['feishuAssigneeName'] = data['feishuAssigneeName'];
    }

    task = this.taskRepo.create({
      tenantId,
      projectId,
      createdBy: SYSTEM_USER_ID,
      title,
      status: TaskStatus.OPEN,
      description: (data['description'] as string | null) ?? null,
      feishuRecordId: feishuRecordId ?? null,
      metadata: newMeta,
    });
    task = await this.taskRepo.save(task);
    return { id: task.id, isNew: true };
  }
}

function extractTextValue(fieldValue: unknown): string {
  if (fieldValue === null || fieldValue === undefined) return '';
  if (typeof fieldValue === 'string') return fieldValue;
  if (Array.isArray(fieldValue)) {
    return fieldValue
      .map((seg: unknown) => {
        if (typeof seg === 'object' && seg !== null) {
          return (seg as Record<string, unknown>)['text'] ?? '';
        }
        return String(seg);
      })
      .join('');
  }
  if (typeof fieldValue === 'object') {
    const obj = fieldValue as Record<string, unknown>;
    if (obj['text'] !== undefined) return String(obj['text']);
  }
  return String(fieldValue);
}

function extractSelectValue(fieldValue: unknown): string {
  if (fieldValue === null || fieldValue === undefined) return '';
  if (typeof fieldValue === 'string') return fieldValue;
  if (typeof fieldValue === 'object') {
    const obj = fieldValue as Record<string, unknown>;
    if (obj['text'] !== undefined) return String(obj['text']);
  }
  return String(fieldValue);
}
