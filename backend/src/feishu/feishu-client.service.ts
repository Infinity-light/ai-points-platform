import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as lark from '@larksuiteoapi/node-sdk';
import { FeishuConfig } from './entities/feishu-config.entity';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

interface CacheEntry {
  client: lark.Client;
  expiresAt: number;
}

@Injectable()
export class FeishuClientService {
  private readonly logger = new Logger(FeishuClientService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(FeishuConfig)
    private readonly configRepo: Repository<FeishuConfig>,
    private readonly configService: ConfigService,
  ) {}

  async getClient(tenantId: string): Promise<lark.Client> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.client;
    }

    const config = await this.configRepo
      .createQueryBuilder('c')
      .addSelect('c.encryptedAppSecret')
      .where('c.tenantId = :tenantId', { tenantId })
      .getOne();

    if (!config || !config.enabled) {
      throw new Error(`飞书配置未找到或未启用 (tenantId=${tenantId})`);
    }

    const appSecret = this.decryptSecret(config.encryptedAppSecret);

    const client = new lark.Client({
      appId: config.appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });

    this.cache.set(tenantId, {
      client,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return client;
  }

  clearCache(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  encryptSecret(plaintext: string): string {
    const key = this.getEncryptKey();
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: iv (12 bytes) + authTag (16 bytes) + encrypted data — all base64
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decryptSecret(ciphertext: string): string {
    const key = this.getEncryptKey();
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const encrypted = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  private getEncryptKey(): Buffer {
    const rawKey = this.configService.get<string>('feishu.encryptKey') ?? '';
    if (!rawKey) {
      throw new Error('FEISHU_ENCRYPT_KEY 环境变量未配置');
    }
    // SHA-256 to ensure 32-byte key for AES-256
    return crypto.createHash('sha256').update(rawKey).digest();
  }
}
