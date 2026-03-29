import { Test, TestingModule } from '@nestjs/testing';
import { PointsService } from './points.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PointRecord, PointSource } from './entities/point-record.entity';
import { PointApprovalBatch } from './entities/point-approval-batch.entity';
import { Project } from '../project/entities/project.entity';
import { User } from '../user/entities/user.entity';
import { ProjectService } from '../project/project.service';

const makeProject = (id: string, settlementRound: number, cyclesPerStep = 3, maxSteps = 4) => ({
  id,
  tenantId: 'tenant-uuid',
  settlementRound,
  annealingConfig: { cyclesPerStep, maxSteps },
});

describe('PointsService', () => {
  let service: PointsService;
  let pointRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock; createQueryBuilder: jest.Mock };
  let projectRepo: { find: jest.Mock };

  beforeEach(async () => {
    pointRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((r) => Promise.resolve({ id: 'record-uuid', ...r })),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    projectRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockBatchRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    const mockUserRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockProjectService = {
      findOne: jest.fn(),
      getMembers: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: getRepositoryToken(PointRecord), useValue: pointRepo },
        { provide: getRepositoryToken(PointApprovalBatch), useValue: mockBatchRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: ProjectService, useValue: mockProjectService },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
  });

  describe('getUserPointsInProject', () => {
    it('应正确计算 tier=0 和 tier=1 的活跃工分（新退火公式）', async () => {
      pointRepo.find.mockResolvedValue([
        { originalPoints: 100, acquiredRound: 1 }, // round 4: roundDiff=3, tier=1 → floor(100/3)=33
        { originalPoints: 50, acquiredRound: 3 },  // round 4: roundDiff=1, tier=0 → 50
      ] as PointRecord[]);

      const result = await service.getUserPointsInProject(
        'tenant-uuid', 'user-uuid', 'proj-uuid',
        4, 3, 4,
      );
      expect(result.originalTotal).toBe(150);
      // 100 → floor(100/3) = 33
      // 50  → 50 (tier=0)
      expect(result.activeTotal).toBe(83);
    });

    it('新鲜工分（同轮）应全额活跃', async () => {
      pointRepo.find.mockResolvedValue([
        { originalPoints: 100, acquiredRound: 5 },
      ] as PointRecord[]);

      const result = await service.getUserPointsInProject(
        'tenant-uuid', 'user-uuid', 'proj-uuid',
        5, 3, 4,
      );
      expect(result.activeTotal).toBe(100);
    });

    it('tier >= maxSteps 时工分清零', async () => {
      pointRepo.find.mockResolvedValue([
        { originalPoints: 100, acquiredRound: 1 }, // round 13: roundDiff=12, tier=4 >= maxSteps=4 → 0
      ] as PointRecord[]);

      const result = await service.getUserPointsInProject(
        'tenant-uuid', 'user-uuid', 'proj-uuid',
        13, 3, 4,
      );
      expect(result.activeTotal).toBe(0);
    });
  });

  describe('getAllMembersActivePoints', () => {
    it('应为所有成员计算活跃工分', async () => {
      pointRepo.find.mockResolvedValue([
        { userId: 'user-1', originalPoints: 100, acquiredRound: 1 }, // round 1: tier=0 → 100
        { userId: 'user-2', originalPoints: 50, acquiredRound: 1 },  // round 1: tier=0 → 50
      ] as PointRecord[]);

      const result = await service.getAllMembersActivePoints(
        'tenant-uuid', 'proj-uuid',
        ['user-1', 'user-2', 'user-3'],
        1, 3, 4,
      );
      expect(result.get('user-1')).toBe(100);
      expect(result.get('user-2')).toBe(50);
      expect(result.get('user-3')).toBe(0); // no records
    });

    it('跨成员的退火应独立计算', async () => {
      pointRepo.find.mockResolvedValue([
        { userId: 'user-1', originalPoints: 100, acquiredRound: 1 }, // round 4: tier=1 → 33
        { userId: 'user-2', originalPoints: 100, acquiredRound: 4 }, // round 4: tier=0 → 100
      ] as PointRecord[]);

      const result = await service.getAllMembersActivePoints(
        'tenant-uuid', 'proj-uuid',
        ['user-1', 'user-2'],
        4, 3, 4,
      );
      expect(result.get('user-1')).toBe(33);
      expect(result.get('user-2')).toBe(100);
    });
  });

  describe('getMySummary', () => {
    it('应使用项目的实际 settlementRound 计算 activePoints', async () => {
      pointRepo.find.mockResolvedValue([
        { projectId: 'proj-1', originalPoints: 100, acquiredRound: 1, createdAt: new Date('2020-01-01') },
      ] as PointRecord[]);
      // proj-1 is at round 4: roundDiff=3, tier=1 → floor(100/3)=33
      projectRepo.find.mockResolvedValue([makeProject('proj-1', 4)]);

      const result = await service.getMySummary('tenant-uuid', 'user-uuid');
      expect(result.totalPoints).toBe(100);
      expect(result.activePoints).toBe(33);
    });

    it('跨项目应独立退火后累计', async () => {
      const now = new Date();
      pointRepo.find.mockResolvedValue([
        { projectId: 'proj-1', originalPoints: 100, acquiredRound: 1, createdAt: new Date('2020-01-01') },
        { projectId: 'proj-2', originalPoints: 90, acquiredRound: 1, createdAt: new Date('2020-01-01') },
      ] as PointRecord[]);
      projectRepo.find.mockResolvedValue([
        makeProject('proj-1', 4),  // roundDiff=3, tier=1 → floor(100/3)=33
        makeProject('proj-2', 1),  // roundDiff=0, tier=0 → 90
      ]);

      const result = await service.getMySummary('tenant-uuid', 'user-uuid');
      expect(result.totalPoints).toBe(190);
      expect(result.activePoints).toBe(123); // 33 + 90
    });

    it('项目不存在时 activePoints 使用原始工分（避免数据丢失）', async () => {
      pointRepo.find.mockResolvedValue([
        { projectId: 'deleted-proj', originalPoints: 50, acquiredRound: 1, createdAt: new Date('2020-01-01') },
      ] as PointRecord[]);
      projectRepo.find.mockResolvedValue([]); // Project not found

      const result = await service.getMySummary('tenant-uuid', 'user-uuid');
      expect(result.activePoints).toBe(50); // fallback to originalPoints
    });

    it('本月工分应只统计本月创建的记录', async () => {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

      pointRepo.find.mockResolvedValue([
        { projectId: 'proj-1', originalPoints: 100, acquiredRound: 1, createdAt: thisMonth },
        { projectId: 'proj-1', originalPoints: 50, acquiredRound: 1, createdAt: lastMonth },
      ] as PointRecord[]);
      projectRepo.find.mockResolvedValue([makeProject('proj-1', 1)]);

      const result = await service.getMySummary('tenant-uuid', 'user-uuid');
      expect(result.totalPoints).toBe(150);
      expect(result.monthlyPoints).toBe(100); // only this month
    });

    it('无记录时返回全零', async () => {
      pointRepo.find.mockResolvedValue([]);
      const result = await service.getMySummary('tenant-uuid', 'user-uuid');
      expect(result).toEqual({ totalPoints: 0, activePoints: 0, monthlyPoints: 0 });
    });
  });
});
