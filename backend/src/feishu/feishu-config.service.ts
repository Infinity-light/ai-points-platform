import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { FeishuConfig } from './entities/feishu-config.entity';
import { FeishuRoleMapping } from './entities/feishu-role-mapping.entity';
import { FeishuClientService } from './feishu-client.service';
import { CreateFeishuConfigDto } from './dto/create-feishu-config.dto';
import { CreateRoleMappingDto } from './dto/create-role-mapping.dto';

@Injectable()
export class FeishuConfigService {
  constructor(
    @InjectRepository(FeishuConfig)
    private readonly configRepo: Repository<FeishuConfig>,
    @InjectRepository(FeishuRoleMapping)
    private readonly mappingRepo: Repository<FeishuRoleMapping>,
    private readonly feishuClientService: FeishuClientService,
  ) {}

  async getConfig(tenantId: string): Promise<FeishuConfig | null> {
    return this.configRepo.findOne({ where: { tenantId } });
  }

  async saveConfig(tenantId: string, dto: CreateFeishuConfigDto, baseUrl: string): Promise<FeishuConfig> {
    let config = await this.configRepo.findOne({ where: { tenantId } });

    const encryptedAppSecret = this.feishuClientService.encryptSecret(dto.appSecret);

    if (config) {
      config.appId = dto.appId;
      config.encryptedAppSecret = encryptedAppSecret;
      if (dto.enabled !== undefined) {
        config.enabled = dto.enabled;
      }
      if (!config.webhookVerifyToken) {
        config.webhookVerifyToken = randomUUID().replace(/-/g, '');
      }
    } else {
      config = this.configRepo.create({
        tenantId,
        appId: dto.appId,
        encryptedAppSecret,
        enabled: dto.enabled ?? false,
        webhookVerifyToken: randomUUID().replace(/-/g, ''),
      });
    }

    const saved = await this.configRepo.save(config);
    // Clear cached client so next call re-reads from DB
    this.feishuClientService.clearCache(tenantId);

    return saved;
  }

  async testConnection(tenantId: string): Promise<{ success: boolean; tenantName?: string; message?: string }> {
    try {
      const config = await this.configRepo
        .createQueryBuilder('c')
        .addSelect('c.encryptedAppSecret')
        .where('c.tenantId = :tenantId', { tenantId })
        .getOne();

      if (!config) {
        return { success: false, message: '飞书配置未找到' };
      }

      const appSecret = this.feishuClientService.decryptSecret(config.encryptedAppSecret);

      const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: config.appId, app_secret: appSecret }),
      });

      const data = await res.json();
      if (data.code !== 0 || !data.tenant_access_token) {
        return { success: false, message: data.msg ?? `错误码: ${data.code}` };
      }

      return { success: true, tenantName: 'Connected' };
    } catch (err) {
      return { success: false, message: String(err) };
    }
  }

  getWebhookUrl(tenantId: string, baseUrl: string): string {
    return `${baseUrl}/feishu-webhook/${tenantId}`;
  }

  async listMappings(tenantId: string): Promise<FeishuRoleMapping[]> {
    return this.mappingRepo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async createMapping(tenantId: string, dto: CreateRoleMappingDto): Promise<FeishuRoleMapping> {
    const mapping = this.mappingRepo.create({
      tenantId,
      feishuRoleName: dto.feishuRoleName,
      platformRoleId: dto.platformRoleId,
    });
    return this.mappingRepo.save(mapping);
  }

  async deleteMapping(tenantId: string, id: string): Promise<void> {
    const mapping = await this.mappingRepo.findOne({ where: { id, tenantId } });
    if (!mapping) {
      throw new NotFoundException(`角色映射 ${id} 不存在`);
    }
    await this.mappingRepo.remove(mapping);
  }

  async getMappingByFeishuRole(tenantId: string, feishuRoleName: string): Promise<FeishuRoleMapping | null> {
    return this.mappingRepo.findOne({ where: { tenantId, feishuRoleName } });
  }
}
