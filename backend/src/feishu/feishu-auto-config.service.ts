import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeishuConfig } from './entities/feishu-config.entity';
import { FeishuClientService } from './feishu-client.service';

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

const REQUIRED_SCOPES = [
  'contact:user.base:readonly',
  'contact:department.base:readonly',
  'contact:user.employee_id:readonly',
  'authen:user.base:readonly',
];

const EVENT_SUBSCRIPTIONS = [
  'contact.user.created_v3',
  'contact.user.updated_v3',
  'contact.user.deleted_v3',
  'contact.department.created_v3',
  'contact.department.updated_v3',
  'contact.department.deleted_v3',
];

export interface ScopeStatus {
  scope: string;
  description: string;
  granted: boolean;
}

export interface AutoConfigStepResult {
  step: string;
  success: boolean;
  message?: string;
}

export interface AutoConfigResult {
  results: AutoConfigStepResult[];
  allSuccess: boolean;
}

@Injectable()
export class FeishuAutoConfigService {
  private readonly logger = new Logger(FeishuAutoConfigService.name);

  constructor(
    @InjectRepository(FeishuConfig)
    private readonly configRepo: Repository<FeishuConfig>,
    private readonly feishuClientService: FeishuClientService,
  ) {}

  async checkScopes(tenantId: string): Promise<{
    scopes: ScopeStatus[];
    requiredScopes: string[];
  }> {
    const token = await this.getTenantAccessToken(tenantId);
    const res = await fetch(`${FEISHU_API_BASE}/application/v6/scopes`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    const items: Array<{ scope: string; description?: string; grant_status?: number }> =
      data?.data?.scopes ?? [];

    const scopes: ScopeStatus[] = REQUIRED_SCOPES.map((scope) => {
      const found = items.find((i) => i.scope === scope);
      return {
        scope,
        description: found?.description ?? scope,
        granted: found?.grant_status === 1,
      };
    });

    return { scopes, requiredScopes: REQUIRED_SCOPES };
  }

  async autoConfigureAll(
    tenantId: string,
    webhookUrl: string,
  ): Promise<AutoConfigResult> {
    const results: AutoConfigStepResult[] = [];

    // Step 1: Configure webhook URL + callback type
    results.push(await this.configureWebhook(tenantId, webhookUrl));

    // Step 2: Configure event subscriptions
    results.push(await this.configureEventSubscriptions(tenantId));

    // Step 3: Configure contacts range to all
    results.push(await this.configureContactsRange(tenantId));

    return {
      results,
      allSuccess: results.every((r) => r.success),
    };
  }

  private async configureWebhook(
    tenantId: string,
    webhookUrl: string,
  ): Promise<AutoConfigStepResult> {
    try {
      const { token, appId } = await this.getTokenAndAppId(tenantId);
      const res = await fetch(
        `${FEISHU_API_BASE}/application/v6/applications/${appId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callback_info: {
              callback_type: 'webhook',
              request_url: webhookUrl,
            },
          }),
        },
      );

      const data = await res.json();
      if (data.code === 0) {
        return { step: 'webhook', success: true };
      }
      return {
        step: 'webhook',
        success: false,
        message: data.msg ?? `Error code: ${data.code}`,
      };
    } catch (err) {
      return { step: 'webhook', success: false, message: String(err) };
    }
  }

  private async configureEventSubscriptions(
    tenantId: string,
  ): Promise<AutoConfigStepResult> {
    try {
      const { token, appId } = await this.getTokenAndAppId(tenantId);
      const res = await fetch(
        `${FEISHU_API_BASE}/application/v6/applications/${appId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callback_info: {
              subscribed_callbacks: EVENT_SUBSCRIPTIONS,
            },
          }),
        },
      );

      const data = await res.json();
      if (data.code === 0) {
        return { step: 'events', success: true };
      }
      return {
        step: 'events',
        success: false,
        message: data.msg ?? `Error code: ${data.code}`,
      };
    } catch (err) {
      return { step: 'events', success: false, message: String(err) };
    }
  }

  private async configureContactsRange(
    tenantId: string,
  ): Promise<AutoConfigStepResult> {
    try {
      const { token, appId } = await this.getTokenAndAppId(tenantId);
      const res = await fetch(
        `${FEISHU_API_BASE}/application/v6/applications/${appId}/contacts_range`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contacts_range_type: 'all',
          }),
        },
      );

      const data = await res.json();
      if (data.code === 0) {
        return { step: 'contacts_range', success: true };
      }
      return {
        step: 'contacts_range',
        success: false,
        message: data.msg ?? `Error code: ${data.code}`,
      };
    } catch (err) {
      return { step: 'contacts_range', success: false, message: String(err) };
    }
  }

  private async getTenantAccessToken(tenantId: string): Promise<string> {
    const config = await this.configRepo
      .createQueryBuilder('c')
      .addSelect('c.encryptedAppSecret')
      .where('c.tenantId = :tenantId', { tenantId })
      .getOne();

    if (!config) {
      throw new Error('飞书配置未找到');
    }

    const appSecret = this.feishuClientService.decryptSecret(
      config.encryptedAppSecret,
    );

    const res = await fetch(
      `${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: config.appId,
          app_secret: appSecret,
        }),
      },
    );

    const data = await res.json();
    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(
        `获取 tenant_access_token 失败: ${data.msg ?? data.code}`,
      );
    }

    return data.tenant_access_token;
  }

  private async getTokenAndAppId(
    tenantId: string,
  ): Promise<{ token: string; appId: string }> {
    const config = await this.configRepo
      .createQueryBuilder('c')
      .addSelect('c.encryptedAppSecret')
      .where('c.tenantId = :tenantId', { tenantId })
      .getOne();

    if (!config) {
      throw new Error('飞书配置未找到');
    }

    const appSecret = this.feishuClientService.decryptSecret(
      config.encryptedAppSecret,
    );

    const res = await fetch(
      `${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: config.appId,
          app_secret: appSecret,
        }),
      },
    );

    const data = await res.json();
    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(
        `获取 tenant_access_token 失败: ${data.msg ?? data.code}`,
      );
    }

    return { token: data.tenant_access_token, appId: config.appId };
  }
}
