import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Tenant } from '../tenant/entities/tenant.entity';
import { User } from '../user/entities/user.entity';
import { Task } from '../task/entities/task.entity';
import { Submission } from '../submission/entities/submission.entity';
import { TenantService } from '../tenant/tenant.service';
import { CreateTenantDto } from '../tenant/dto/create-tenant.dto';
import { UpdateTenantDto } from '../tenant/dto/update-tenant.dto';
import { UpdateConfigDto } from './dto/update-config.dto';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'global-config.json');

export interface GlobalConfig {
  llmModel: string;
  llmBaseUrl: string;
  maxFileSizeMb: number;
}

const DEFAULT_CONFIG: GlobalConfig = {
  llmModel: 'claude-sonnet-4-6',
  llmBaseUrl: '',
  maxFileSizeMb: 10,
};

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly tenantService: TenantService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
  ) {}

  // Tenant management (delegate to TenantService)
  listTenants(): Promise<Tenant[]> {
    return this.tenantService.findAll();
  }

  createTenant(dto: CreateTenantDto): Promise<Tenant> {
    return this.tenantService.create(dto);
  }

  updateTenant(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    return this.tenantService.update(id, dto);
  }

  removeTenant(id: string): Promise<void> {
    return this.tenantService.remove(id);
  }

  // Global config
  async getConfig(): Promise<GlobalConfig> {
    try {
      const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw) as GlobalConfig;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  async updateConfig(dto: UpdateConfigDto): Promise<GlobalConfig> {
    const current = await this.getConfig();
    const updated = { ...current, ...dto };
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2));
    return updated;
  }

  // Operations stats
  async getOps(): Promise<{
    totalTenants: number;
    totalUsers: number;
    totalTasks: number;
    totalSubmissions: number;
  }> {
    const [totalTenants, totalUsers, totalTasks, totalSubmissions] =
      await Promise.all([
        this.tenantService.findAll().then((list) => list.length),
        this.userRepository.count(),
        this.taskRepository.count(),
        this.submissionRepository.count(),
      ]);

    return { totalTenants, totalUsers, totalTasks, totalSubmissions };
  }
}
