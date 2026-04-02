import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { OpenApiKey } from './entities/open-api-key.entity';
import { CreateOpenApiKeyDto } from './dto/create-open-api-key.dto';

@Injectable()
export class OpenApiKeyService {
  constructor(
    @InjectRepository(OpenApiKey)
    private readonly keyRepo: Repository<OpenApiKey>,
  ) {}

  async create(
    tenantId: string,
    createdBy: string,
    dto: CreateOpenApiKeyDto,
  ): Promise<{ key: OpenApiKey; rawKey: string }> {
    const rawKey = `sk-${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 8); // "sk-XXXXX" (includes sk- prefix)

    const key = this.keyRepo.create({
      tenantId,
      createdBy,
      label: dto.label,
      keyHash,
      keyPrefix,
      isActive: true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    const saved = await this.keyRepo.save(key);
    return { key: saved, rawKey };
  }

  async list(tenantId: string): Promise<OpenApiKey[]> {
    return this.keyRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string, tenantId: string): Promise<void> {
    const key = await this.keyRepo.findOne({ where: { id, tenantId } });
    if (!key) throw new NotFoundException(`Open API key ${id} not found`);
    key.isActive = false;
    await this.keyRepo.save(key);
  }

  async validateKey(rawKey: string): Promise<OpenApiKey | null> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const key = await this.keyRepo.findOne({ where: { keyHash, isActive: true } });
    if (!key) return null;

    // Check expiry
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    // Fire-and-forget lastUsedAt update — do not await to avoid blocking the response
    void this.keyRepo.update(key.id, { lastUsedAt: new Date() });

    return key;
  }
}
