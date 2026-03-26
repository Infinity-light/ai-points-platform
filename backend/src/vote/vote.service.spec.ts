import { Test, TestingModule } from '@nestjs/testing';
import { VoteService } from './vote.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VoteSession, VoteSessionStatus } from './entities/vote-session.entity';
import { VoteRecord } from './entities/vote-record.entity';
import { PointsService } from '../points/points.service';
import { ProjectService } from '../project/project.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

const mockProject = {
  id: 'proj-uuid',
  tenantId: 'tenant-uuid',
  settlementRound: 3,
  annealingConfig: { cyclesPerStep: 3, maxSteps: 9 },
  name: 'Test Project',
  description: null,
  status: 'active',
  createdBy: 'user-uuid',
  settlementConfig: { periodType: 'weekly' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSession = {
  id: 'session-uuid',
  tenantId: 'tenant-uuid',
  projectId: 'proj-uuid',
  status: VoteSessionStatus.OPEN,
  createdBy: 'user-uuid',
  taskIds: ['task-1', 'task-2'],
  result: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('VoteService', () => {
  let service: VoteService;
  let voteSessionRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let voteRecordRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let pointsService: { getAllMembersActivePoints: jest.Mock };
  let projectService: { findOne: jest.Mock; getMembers: jest.Mock };

  beforeEach(async () => {
    voteSessionRepo = {
      create: jest.fn().mockImplementation((d) => ({ ...mockSession, ...d })),
      save: jest.fn().mockImplementation((s) => Promise.resolve({ ...s })),
      findOne: jest.fn().mockImplementation(() => Promise.resolve({ ...mockSession })),
      find: jest.fn().mockResolvedValue([{ ...mockSession }]),
    };
    voteRecordRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((r) => Promise.resolve({ id: 'record-uuid', ...r })),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    pointsService = {
      getAllMembersActivePoints: jest.fn().mockResolvedValue(new Map([['user-uuid', 100]])),
    };
    projectService = {
      findOne: jest.fn().mockResolvedValue(mockProject),
      getMembers: jest.fn().mockResolvedValue([{ userId: 'user-uuid' }, { userId: 'user-2' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteService,
        { provide: getRepositoryToken(VoteSession), useValue: voteSessionRepo },
        { provide: getRepositoryToken(VoteRecord), useValue: voteRecordRepo },
        { provide: PointsService, useValue: pointsService },
        { provide: ProjectService, useValue: projectService },
      ],
    }).compile();

    service = module.get<VoteService>(VoteService);
  });

  describe('calculateWeight', () => {
    it('活跃工分>0时返回实际工分', () => expect(service.calculateWeight(100)).toBe(100));
    it('活跃工分=0时返回基础票权1', () => expect(service.calculateWeight(0)).toBe(1));
  });

  describe('createSession', () => {
    it('应该创建投票会话', async () => {
      const result = await service.createSession('tenant-uuid', 'proj-uuid', 'user-uuid', ['task-1']);
      expect(result.status).toBe(VoteSessionStatus.OPEN);
    });

    it('空任务列表应该抛出 BadRequestException', async () => {
      await expect(service.createSession('tenant-uuid', 'proj-uuid', 'user-uuid', []))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('castVote', () => {
    it('应该记录投票并计算权重', async () => {
      const result = await service.castVote('session-uuid', 'tenant-uuid', 'user-uuid', true);
      expect(result.vote).toBe(true);
      expect(Number(result.weight)).toBe(100); // user has 100 active points
    });

    it('重复投票应该抛出 ConflictException', async () => {
      voteRecordRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.castVote('session-uuid', 'tenant-uuid', 'user-uuid', true))
        .rejects.toThrow(ConflictException);
    });

    it('已关闭的会话不能投票', async () => {
      voteSessionRepo.findOne.mockResolvedValue({ ...mockSession, status: VoteSessionStatus.CLOSED });
      await expect(service.castVote('session-uuid', 'tenant-uuid', 'user-uuid', true))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('closeSession', () => {
    it('应该统计加权票数并判断通过', async () => {
      // 2 members: user-uuid votes yes (weight 100), user-2 votes yes (weight 50)
      voteRecordRepo.find.mockResolvedValue([
        { voteSessionId: 'session-uuid', userId: 'user-uuid', vote: true, weight: '100' },
        { voteSessionId: 'session-uuid', userId: 'user-2', vote: true, weight: '50' },
      ]);
      const result = await service.closeSession('session-uuid', 'tenant-uuid');
      expect(result.status).toBe(VoteSessionStatus.PASSED);
      expect(result.result.weightedYesRatio).toBe(1); // 100% yes
    });

    it('参与率低于50%时应该失败', async () => {
      // 2 members, only 1 voted (50% participation = not > 50%)
      voteRecordRepo.find.mockResolvedValue([
        { voteSessionId: 'session-uuid', userId: 'user-uuid', vote: true, weight: '100' },
      ]);
      const result = await service.closeSession('session-uuid', 'tenant-uuid');
      // participationRatio = 1/2 = 0.5, not > 0.5 → FAILED
      expect(result.status).toBe(VoteSessionStatus.FAILED);
    });
  });
});
