import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Project, ProjectStatus, AnnealingConfig, SettlementConfig, FieldDef } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly memberRepository: Repository<ProjectMember>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, createdBy: string, dto: CreateProjectDto): Promise<Project> {
    const defaults: AnnealingConfig = { cyclesPerStep: 3, maxSteps: 9 };
    const settlementDefaults: SettlementConfig = { mode: 'manual' };

    const project = this.projectRepository.create({
      tenantId,
      createdBy,
      name: dto.name,
      description: dto.description ?? null,
      status: ProjectStatus.ACTIVE,
      annealingConfig: { ...defaults, ...dto.annealingConfig },
      settlementConfig: { ...settlementDefaults, ...dto.settlementConfig },
    });

    const saved = await this.projectRepository.save(project);

    // 创建者自动成为成员
    await this.addMember(saved.id, tenantId, createdBy, true);

    // 通知飞书集成模块（如已配置）自动创建 Bitable
    this.eventEmitter.emit('project.created', {
      projectId: saved.id,
      tenantId,
      projectName: saved.name,
    });

    return saved;
  }

  /**
   * 可见性规则：
   * - project_lead / hr_admin / super_admin 创建的项目 → 所有人可见
   * - employee 创建的项目 → 仅创建者本人及项目成员可见
   */
  async findAll(tenantId: string, currentUserId: string): Promise<Project[]> {
    // Roles that make a project publicly visible within the tenant
    const publicRoleIds = [
      '00000000-0000-0000-0000-000000000001', // super_admin
      '00000000-0000-0000-0000-000000000002', // hr_admin
      '00000000-0000-0000-0000-000000000003', // project_lead
    ];

    return this.projectRepository
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere(
        `(
          p."createdBy" = :currentUserId
          OR EXISTS (
            SELECT 1 FROM "project_members" pm
            WHERE pm."projectId" = p."id" AND pm."userId" = :currentUserId
          )
          OR EXISTS (
            SELECT 1 FROM "user_roles" ur
            WHERE ur."userId" = p."createdBy" AND ur."roleId" IN (:...publicRoleIds)
          )
        )`,
        { currentUserId, publicRoleIds },
      )
      .orderBy('p.createdAt', 'DESC')
      .getMany();
  }

  async findMyProjects(tenantId: string, userId: string): Promise<Project[]> {
    // 返回用户是成员的项目
    const memberships = await this.memberRepository.find({
      where: { tenantId, userId },
    });
    if (memberships.length === 0) return [];
    const projectIds = memberships.map((m) => m.projectId);
    return this.projectRepository
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.id IN (:...projectIds)', { projectIds })
      .orderBy('p.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string, tenantId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id, tenantId } });
    if (!project) throw new NotFoundException(`项目 ${id} 不存在`);
    return project;
  }

  async update(id: string, tenantId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id, tenantId);
    if (dto.annealingConfig) {
      project.annealingConfig = { ...project.annealingConfig, ...dto.annealingConfig };
    }
    if (dto.settlementConfig) {
      project.settlementConfig = {
        ...project.settlementConfig,
        ...dto.settlementConfig,
      } as SettlementConfig;
    }
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description ?? null;
    return this.projectRepository.save(project);
  }

  async archive(id: string, tenantId: string): Promise<Project> {
    const project = await this.findOne(id, tenantId);
    project.status = ProjectStatus.ARCHIVED;
    return this.projectRepository.save(project);
  }

  async getMembers(projectId: string, tenantId: string): Promise<ProjectMember[]> {
    await this.findOne(projectId, tenantId); // ensure exists
    return this.memberRepository.find({
      where: { projectId, tenantId },
      order: { joinedAt: 'ASC' },
    });
  }

  async addMember(
    projectId: string,
    tenantId: string,
    userId: string,
    skipExistsCheck = false,
  ): Promise<ProjectMember> {
    if (!skipExistsCheck) {
      const existing = await this.memberRepository.findOne({ where: { projectId, userId } });
      if (existing) throw new ConflictException('用户已是项目成员');
    }

    const member = this.memberRepository.create({ projectId, userId, tenantId });
    return this.memberRepository.save(member);
  }

  async removeMember(projectId: string, tenantId: string, userId: string): Promise<void> {
    const member = await this.memberRepository.findOne({ where: { projectId, userId, tenantId } });
    if (!member) throw new NotFoundException('该用户不是项目成员');
    await this.memberRepository.remove(member);
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findOne({ where: { projectId, userId } });
    return !!member;
  }

  async incrementSettlementRound(id: string, tenantId: string): Promise<Project> {
    const project = await this.findOne(id, tenantId);
    project.settlementRound = project.settlementRound + 1;
    return this.projectRepository.save(project);
  }

  async getCustomFields(projectId: string, tenantId: string): Promise<FieldDef[]> {
    const project = await this.findOne(projectId, tenantId);
    return project.metadata?.customFields ?? [];
  }

  async updateCustomFields(
    projectId: string,
    tenantId: string,
    fields: FieldDef[],
  ): Promise<FieldDef[]> {
    const keys = fields.map((f) => f.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('customFields 中存在重复的 key');
    }
    const project = await this.findOne(projectId, tenantId);
    project.metadata = { ...project.metadata, customFields: fields };
    await this.projectRepository.save(project);
    return fields;
  }
}
