import api from '@/lib/axios';
import type { RoleDto } from '@/services/rbac';

export interface FeishuConfig {
  appId: string;
  enabled: boolean;
  webhookUrl: string;
  webhookVerifyToken: string;
  hasSecret: boolean;
}

export interface SaveFeishuConfigPayload {
  appId: string;
  appSecret: string;
  enabled: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  tenantName?: string;
  message?: string;
}

export interface FeishuRoleMapping {
  id: string;
  feishuRoleName: string;
  platformRoleId: string;
  platformRoleName: string;
}

export interface RoleMappingsResponse {
  items: FeishuRoleMapping[];
}

export interface CreateMappingPayload {
  feishuRoleName: string;
  platformRoleId: string;
}

export interface TriggerSyncResponse {
  jobId: string;
  message: string;
}

export interface SyncLog {
  id: string;
  type: 'full' | 'incremental';
  status: 'pending' | 'running' | 'success' | 'failed';
  stats: {
    departmentCount?: number;
    userCount?: number;
    created?: number;
    updated?: number;
    deactivated?: number;
  } | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface SyncLogsResponse {
  items: SyncLog[];
  total: number;
}

export interface SyncLogsParams {
  page?: number;
  limit?: number;
}

export interface FeishuEnabledResponse {
  enabled: boolean;
}

// Auto Config types
export interface AutoConfigStepResult {
  step: string;
  success: boolean;
  message?: string;
}

export interface AutoConfigResult {
  results: AutoConfigStepResult[];
  allSuccess: boolean;
}

export interface ScopeStatus {
  scope: string;
  description: string;
  granted: boolean;
}

export interface CheckScopesResponse {
  scopes: ScopeStatus[];
  requiredScopes: string[];
}

export const feishuConfigApi = {
  getConfig: (): Promise<FeishuConfig> =>
    api.get<FeishuConfig>('/feishu-config').then((r) => r.data),

  saveConfig: (data: SaveFeishuConfigPayload): Promise<FeishuConfig> =>
    api.post<FeishuConfig>('/feishu-config', data).then((r) => r.data),

  testConnection: (): Promise<TestConnectionResult> =>
    api.post<TestConnectionResult>('/feishu-config/test-connection').then((r) => r.data),

  listMappings: (): Promise<RoleMappingsResponse> =>
    api.get<RoleMappingsResponse>('/feishu-config/role-mappings').then((r) => r.data),

  createMapping: (data: CreateMappingPayload): Promise<FeishuRoleMapping> =>
    api.post<FeishuRoleMapping>('/feishu-config/role-mappings', data).then((r) => r.data),

  deleteMapping: (id: string): Promise<void> =>
    api.delete(`/feishu-config/role-mappings/${id}`).then(() => undefined),

  triggerSync: (): Promise<TriggerSyncResponse> =>
    api.post<TriggerSyncResponse>('/feishu-config/sync').then((r) => r.data),

  listSyncLogs: (params?: SyncLogsParams): Promise<SyncLogsResponse> =>
    api.get<SyncLogsResponse>('/feishu-config/sync-logs', { params }).then((r) => r.data),

  checkFeishuEnabled: (tenantSlug: string): Promise<FeishuEnabledResponse> =>
    api.get<FeishuEnabledResponse>('/auth/feishu/check', { params: { tenantSlug } }).then((r) => r.data),

  listRoles: (): Promise<RoleDto[]> =>
    api.get<RoleDto[]>('/rbac/roles').then((r) => r.data),

  // Auto Configuration
  autoConfigure: (): Promise<AutoConfigResult> =>
    api.post<AutoConfigResult>('/feishu-config/auto-configure').then((r) => r.data),

  checkScopes: (): Promise<CheckScopesResponse> =>
    api.get<CheckScopesResponse>('/feishu-config/check-scopes').then((r) => r.data),
};
