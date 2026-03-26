import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from './enums/task-status.enum';

// 合法的状态转换映射
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.OPEN]: [TaskStatus.CLAIMED, TaskStatus.CANCELLED],
  [TaskStatus.CLAIMED]: [TaskStatus.SUBMITTED, TaskStatus.OPEN, TaskStatus.CANCELLED], // OPEN = 放弃认领
  [TaskStatus.SUBMITTED]: [TaskStatus.AI_REVIEWING, TaskStatus.CANCELLED],
  [TaskStatus.AI_REVIEWING]: [TaskStatus.PENDING_VOTE, TaskStatus.CANCELLED],
  [TaskStatus.PENDING_VOTE]: [TaskStatus.SETTLED, TaskStatus.CANCELLED],
  [TaskStatus.SETTLED]: [], // 终态，不可转换
  [TaskStatus.CANCELLED]: [], // 终态，不可转换
};

export function validateTransition(from: TaskStatus, to: TaskStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new BadRequestException(
      `不能从状态 "${from}" 转换到 "${to}"。允许的转换：${allowed.join(', ') || '无'}`,
    );
  }
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function getAllowedTransitions(from: TaskStatus): TaskStatus[] {
  return [...VALID_TRANSITIONS[from]];
}
