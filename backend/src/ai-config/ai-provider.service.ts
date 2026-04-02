import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProvider } from './entities/ai-provider.entity';
import { AiProviderKey } from './entities/ai-provider-key.entity';
import { CreateAiProviderDto, CreateAiProviderKeyDto } from './dto/create-ai-provider.dto';

@Injectable()
export class AiProviderService {
  constructor(
    @InjectRepository(AiProvider)
    private readonly providerRepo: Repository<AiProvider>,
    @InjectRepository(AiProviderKey)
    private readonly keyRepo: Repository<AiProviderKey>,
  ) {}

  async list(tenantId: string): Promise<AiProvider[]> {
    return this.providerRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(tenantId: string, dto: CreateAiProviderDto): Promise<AiProvider> {
    const provider = this.providerRepo.create({
      tenantId,
      name: dto.name,
      type: dto.type,
      baseUrl: dto.baseUrl ?? null,
      config: dto.config ?? {},
      isActive: true,
    });
    return this.providerRepo.save(provider);
  }

  async update(
    id: string,
    tenantId: string,
    dto: Partial<CreateAiProviderDto>,
  ): Promise<AiProvider> {
    const provider = await this.findOneOrFail(id, tenantId);
    if (dto.name !== undefined) provider.name = dto.name;
    if (dto.type !== undefined) provider.type = dto.type;
    if (dto.baseUrl !== undefined) provider.baseUrl = dto.baseUrl ?? null;
    if (dto.config !== undefined) provider.config = dto.config ?? {};
    return this.providerRepo.save(provider);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const provider = await this.findOneOrFail(id, tenantId);
    await this.providerRepo.remove(provider);
  }

  async listKeys(providerId: string, tenantId: string): Promise<AiProviderKey[]> {
    await this.findOneOrFail(providerId, tenantId);
    return this.keyRepo.find({
      where: { providerId, tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async addKey(
    providerId: string,
    tenantId: string,
    dto: CreateAiProviderKeyDto,
  ): Promise<AiProviderKey> {
    await this.findOneOrFail(providerId, tenantId);
    const key = this.keyRepo.create({
      tenantId,
      providerId,
      label: dto.label,
      encryptedKey: dto.key,
      model: dto.model ?? null,
      isActive: true,
    });
    return this.keyRepo.save(key);
  }

  async removeKey(keyId: string, tenantId: string): Promise<void> {
    const key = await this.keyRepo.findOne({ where: { id: keyId, tenantId } });
    if (!key) throw new NotFoundException(`Provider key ${keyId} not found`);
    await this.keyRepo.remove(key);
  }

  async getActiveKey(tenantId: string, providerId: string): Promise<AiProviderKey | null> {
    return this.keyRepo.findOne({
      where: { tenantId, providerId, isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  private async findOneOrFail(id: string, tenantId: string): Promise<AiProvider> {
    const provider = await this.providerRepo.findOne({ where: { id, tenantId } });
    if (!provider) throw new NotFoundException(`AI provider ${id} not found`);
    return provider;
  }
}
