import { Test, TestingModule } from '@nestjs/testing';
import { PointsService } from './points.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PointRecord, PointSource } from './entities/point-record.entity';

describe('PointsService', () => {
  let service: PointsService;
  let repo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((r) => Promise.resolve({ id: 'record-uuid', ...r })),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: getRepositoryToken(PointRecord), useValue: repo },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
  });

  describe('getUserPointsInProject', () => {
    it('应该正确计算活跃工分（退火）', async () => {
      repo.find.mockResolvedValue([
        { originalPoints: 100, acquiredRound: 1 }, // At round 4: n=2, active=50
        { originalPoints: 50, acquiredRound: 3 },  // At round 4: n=1, active=50 (diff=1, ceil(1/3)=1, n=2) → 25
      ] as PointRecord[]);

      const result = await service.getUserPointsInProject(
        'tenant-uuid', 'user-uuid', 'proj-uuid',
        4, 3, 9,
      );
      expect(result.originalTotal).toBe(150);
      // 100: acquiredRound=1, current=4, diff=3, floor(3/3)=1, n=2, active=50
      // 50: acquiredRound=3, current=4, diff=1, floor(1/3)=0, n=1, active=50
      expect(result.activeTotal).toBe(100);
    });

    it('新鲜工分（同轮）应该全额活跃', async () => {
      repo.find.mockResolvedValue([
        { originalPoints: 100, acquiredRound: 5 },
      ] as PointRecord[]);

      const result = await service.getUserPointsInProject(
        'tenant-uuid', 'user-uuid', 'proj-uuid',
        5, 3, 9,
      );
      expect(result.activeTotal).toBe(100);
    });
  });

  describe('getAllMembersActivePoints', () => {
    it('应该为所有成员计算活跃工分', async () => {
      repo.find.mockResolvedValue([
        { userId: 'user-1', originalPoints: 100, acquiredRound: 1 },
        { userId: 'user-2', originalPoints: 50, acquiredRound: 1 },
      ] as PointRecord[]);

      const result = await service.getAllMembersActivePoints(
        'tenant-uuid', 'proj-uuid',
        ['user-1', 'user-2', 'user-3'], // user-3 has no records
        1, 3, 9,
      );
      expect(result.get('user-1')).toBe(100);
      expect(result.get('user-2')).toBe(50);
      expect(result.get('user-3')).toBe(0); // no records
    });
  });
});
