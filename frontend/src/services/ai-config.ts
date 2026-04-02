import api from '@/lib/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiProvider {
  id: string;
  tenantId: string;
  name: string;
  type: 'anthropic' | 'openai' | 'azure_openai' | 'custom';
  baseUrl: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AiProviderKey {
  id: string;
  providerId: string;
  keyMask: string;
  isActive: boolean;
  cooldownUntil: string | null;
  usageCount: number;
  createdAt: string;
}

export interface OpenApiKey {
  id: string;
  tenantId: string;
  label: string;
  keyPrefix: string;
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateProviderPayload {
  name: string;
  type: 'anthropic' | 'openai' | 'azure_openai' | 'custom';
  baseUrl?: string;
  config?: Record<string, unknown>;
}

export interface CreateProviderKeyPayload {
  apiKey: string;
}

export interface CreateOpenApiKeyPayload {
  label: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const aiConfigApi = {
  // Providers
  listProviders: () =>
    api.get<AiProvider[]>('/ai-config/providers'),
  createProvider: (payload: CreateProviderPayload) =>
    api.post<AiProvider>('/ai-config/providers', payload),
  updateProvider: (id: string, payload: Partial<CreateProviderPayload>) =>
    api.patch<AiProvider>(`/ai-config/providers/${id}`, payload),
  removeProvider: (id: string) =>
    api.delete(`/ai-config/providers/${id}`),

  // Provider Keys
  listKeys: (providerId: string) =>
    api.get<AiProviderKey[]>(`/ai-config/providers/${providerId}/keys`),
  addKey: (providerId: string, payload: CreateProviderKeyPayload) =>
    api.post<AiProviderKey>(`/ai-config/providers/${providerId}/keys`, payload),
  removeKey: (providerId: string, keyId: string) =>
    api.delete(`/ai-config/providers/${providerId}/keys/${keyId}`),

  // Open API Keys
  listOpenApiKeys: () =>
    api.get<OpenApiKey[]>('/ai-config/open-api-keys'),
  createOpenApiKey: (payload: CreateOpenApiKeyPayload) =>
    api.post<{ key: OpenApiKey; rawKey: string }>('/ai-config/open-api-keys', payload),
  revokeOpenApiKey: (id: string) =>
    api.delete(`/ai-config/open-api-keys/${id}`),
};
