import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

const mockProject: Project = {
  id: 'proj-uuid',
  tenantId: 'tenant-uuid',
  name: '测试项目',
  description: null,
  status: ProjectStatus.ACTIVE,
  annealingConfig: { cyclesPerStep: 3, maxSteps: 9 },
  settlementConfig: { mode: 'manual' },
  createdBy: 'user-uuid',
  settlementRound: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let memberRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    projectRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...mockProject, ...data })),
      save: jest.fn().mockImplementation((p) => Promise.resolve({ ...mockProject, ...p })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([mockProject]),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockProject]),
      }),
    };

    memberRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((m) => Promise.resolve({ id: 'member-uuid', ...m })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getRepositoryToken(ProjectMember), useValue: memberRepo },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('create', () => {
    it('应该创建项目并添加创建者为成员', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      const result = await service.create('tenant-uuid', 'user-uuid', { name: '测试项目' });
      expect(result.name).toBe('测试项目');
      expect(memberRepo.save).toHaveBeenCalled();
    });

    it('应该使用默认退火配置', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      const result = await service.create('tenant-uuid', 'user-uuid', { name: 'test' });
      expect(result.annealingConfig.cyclesPerStep).toBe(3);
      expect(result.annealingConfig.maxSteps).toBe(9);
    });

    it('应该合并自定义退火配置', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      projectRepo.create.mockImplementation((data) => ({ ...mockProject, ...data }));
      projectRepo.save.mockImplementation((p) => Promise.resolve(p));
      const result = await service.create('tenant-uuid', 'user-uuid', {
        name: 'test',
        annealingConfig: { cyclesPerStep: 5 },
      });
      expect(result.annealingConfig.cyclesPerStep).toBe(5);
      expect(result.annealingConfig.maxSteps).toBe(9);
    });
  });

  describe('findOne', () => {
    it('应该返回存在的项目', async () => {
      projectRepo.findOne.mockResolvedValue(mockProject);
      const result = await service.findOne('proj-uuid', 'tenant-uuid');
      expect(result.id).toBe('proj-uuid');
    });

    it('不存在的项目应该抛出 NotFoundException', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', 'tenant-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('应该将项目状态改为 archived', async () => {
      projectRepo.findOne.mockResolvedValue({ ...mockProject });
      projectRepo.save.mockImplementation((p) => Promise.resolve(p));
      const result = await service.archive('proj-uuid', 'tenant-uuid');
      expect(result.status).toBe(ProjectStatus.ARCHIVED);
    });
  });

  describe('addMember', () => {
    it('应该添加新成员', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      const result = await service.addMember('proj-uuid', 'tenant-uuid', 'new-user');
      expect(memberRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('重复添加应该抛出 ConflictException', async () => {
      memberRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.addMember('proj-uuid', 'tenant-uuid', 'user-uuid')).rejects.toThrow(ConflictException);
    });
  });

  describe('removeMember', () => {
    it('应该移除成员', async () => {
      memberRepo.findOne.mockResolvedValue({ id: 'member-uuid', projectId: 'proj-uuid', userId: 'user-uuid', tenantId: 'tenant-uuid' });
      await service.removeMember('proj-uuid', 'tenant-uuid', 'user-uuid');
      expect(memberRepo.remove).toHaveBeenCalled();
    });

    it('不存在的成员应该抛出 NotFoundException', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      await expect(service.removeMember('proj-uuid', 'tenant-uuid', 'nobody')).rejects.toThrow(NotFoundException);
    });
  });

  describe('isMember', () => {
    it('应该返回 true 如果是成员', async () => {
      memberRepo.findOne.mockResolvedValue({ id: 'member-uuid' });
      expect(await service.isMember('proj-uuid', 'user-uuid')).toBe(true);
    });

    it('应该返回 false 如果不是成员', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      expect(await service.isMember('proj-uuid', 'nobody')).toBe(false);
    });
  });
});
