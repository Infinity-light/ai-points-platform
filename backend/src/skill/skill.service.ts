import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill, SkillStatus } from './entities/skill.entity';
import { Submission } from '../submission/entities/submission.entity';

@Injectable()
export class SkillService {
  constructor(
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
  ) {}

  async registerOrUpdateSkill(options: {
    tenantId: string;
    projectId: string;
    authorId: string;
    submissionId: string;
    skillName: string;
    skillDescription: string;
    skillContent: string;
    repoUrl?: string;
  }): Promise<{ skill: Skill; version: number }> {
    const { tenantId, projectId, authorId, submissionId, skillName, skillDescription, skillContent, repoUrl } = options;

    const existing = await this.skillRepository.findOne({
      where: { tenantId, projectId, name: skillName },
    });

    if (existing) {
      existing.version = existing.version + 1;
      existing.description = skillDescription;
      existing.content = skillContent;
      existing.repoUrl = repoUrl ?? existing.repoUrl;
      existing.latestSubmissionId = submissionId;
      existing.status = SkillStatus.ACTIVE;

      const saved = await this.skillRepository.save(existing);
      return { skill: saved, version: saved.version };
    }

    const skill = this.skillRepository.create({
      tenantId,
      projectId,
      name: skillName,
      description: skillDescription,
      content: skillContent,
      repoUrl: repoUrl ?? null,
      authorId,
      latestSubmissionId: submissionId,
      version: 1,
      status: SkillStatus.ACTIVE,
    });

    const saved = await this.skillRepository.save(skill);
    return { skill: saved, version: saved.version };
  }

  async findForProject(tenantId: string, projectId: string): Promise<Skill[]> {
    return this.skillRepository.find({
      where: { tenantId, projectId, status: SkillStatus.ACTIVE },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Skill> {
    const skill = await this.skillRepository.findOne({ where: { id, tenantId } });
    if (!skill) throw new NotFoundException(`技能 ${id} 不存在`);
    return skill;
  }

  async findSubmissions(skillId: string, tenantId: string): Promise<Submission[]> {
    const skill = await this.findOne(skillId, tenantId);

    // Find all submissions that reference this skill in metadata
    const allSubmissions = await this.submissionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    return allSubmissions.filter((s) => {
      const meta = s.metadata as Record<string, unknown>;
      return meta.skillId === skill.id;
    });
  }

  validateSkillMetadata(options: {
    skillName?: unknown;
    skillDescription?: unknown;
    skillContent?: unknown;
  }): void {
    const { skillName, skillDescription, skillContent } = options;
    if (!skillName || typeof skillName !== 'string') {
      throw new BadRequestException('explore 类型提交包含 skillName 时，必须提供有效的 skillName');
    }
    if (!skillDescription || typeof skillDescription !== 'string') {
      throw new BadRequestException('explore 类型提交包含 skillName 时，必须提供 skillDescription');
    }
    if (!skillContent || typeof skillContent !== 'string') {
      throw new BadRequestException('explore 类型提交包含 skillName 时，必须提供 skillContent');
    }
  }
}
