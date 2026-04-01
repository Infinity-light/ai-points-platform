import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from './enums/task-status.enum';
import { validateTransition, canTransition, getAllowedTransitions } from './task-state-machine';

describe('TaskStateMachine', () => {
  describe('validateTransition', () => {
    // 合法转换
    it('OPEN → CLAIMED 合法', () => expect(() => validateTransition(TaskStatus.OPEN, TaskStatus.CLAIMED)).not.toThrow());
    it('OPEN → CANCELLED 合法', () => expect(() => validateTransition(TaskStatus.OPEN, TaskStatus.CANCELLED)).not.toThrow());
    it('CLAIMED → SUBMITTED 合法', () => expect(() => validateTransition(TaskStatus.CLAIMED, TaskStatus.SUBMITTED)).not.toThrow());
    it('CLAIMED → OPEN 合法 (放弃认领)', () => expect(() => validateTransition(TaskStatus.CLAIMED, TaskStatus.OPEN)).not.toThrow());
    it('SUBMITTED → AI_REVIEWING 合法', () => expect(() => validateTransition(TaskStatus.SUBMITTED, TaskStatus.AI_REVIEWING)).not.toThrow());
    it('AI_REVIEWING → PENDING_REVIEW 合法（新主路径）', () => expect(() => validateTransition(TaskStatus.AI_REVIEWING, TaskStatus.PENDING_REVIEW)).not.toThrow());
    it('PENDING_REVIEW → SETTLED 合法', () => expect(() => validateTransition(TaskStatus.PENDING_REVIEW, TaskStatus.SETTLED)).not.toThrow());
    it('PENDING_VOTE → SETTLED 合法（旧流程向后兼容）', () => expect(() => validateTransition(TaskStatus.PENDING_VOTE, TaskStatus.SETTLED)).not.toThrow());

    // 非法转换
    it('OPEN → SUBMITTED 非法', () => expect(() => validateTransition(TaskStatus.OPEN, TaskStatus.SUBMITTED)).toThrow(BadRequestException));
    it('SETTLED → OPEN 非法 (终态)', () => expect(() => validateTransition(TaskStatus.SETTLED, TaskStatus.OPEN)).toThrow(BadRequestException));
    it('CANCELLED → OPEN 非法 (终态)', () => expect(() => validateTransition(TaskStatus.CANCELLED, TaskStatus.OPEN)).toThrow(BadRequestException));
    it('SUBMITTED → SETTLED 非法 (跳步)', () => expect(() => validateTransition(TaskStatus.SUBMITTED, TaskStatus.SETTLED)).toThrow(BadRequestException));
    it('PENDING_VOTE → AI_REVIEWING 非法 (回退)', () => expect(() => validateTransition(TaskStatus.PENDING_VOTE, TaskStatus.AI_REVIEWING)).toThrow(BadRequestException));
    it('AI_REVIEWING → PENDING_VOTE 非法（旧路径已移除）', () => expect(() => validateTransition(TaskStatus.AI_REVIEWING, TaskStatus.PENDING_VOTE)).toThrow(BadRequestException));
  });

  describe('canTransition', () => {
    it('合法转换返回 true', () => expect(canTransition(TaskStatus.OPEN, TaskStatus.CLAIMED)).toBe(true));
    it('非法转换返回 false', () => expect(canTransition(TaskStatus.SETTLED, TaskStatus.OPEN)).toBe(false));
  });

  describe('getAllowedTransitions', () => {
    it('OPEN 允许 CLAIMED 和 CANCELLED', () => {
      const allowed = getAllowedTransitions(TaskStatus.OPEN);
      expect(allowed).toContain(TaskStatus.CLAIMED);
      expect(allowed).toContain(TaskStatus.CANCELLED);
      expect(allowed.length).toBe(2);
    });

    it('SETTLED 没有允许的转换', () => {
      expect(getAllowedTransitions(TaskStatus.SETTLED)).toHaveLength(0);
    });
  });
});
