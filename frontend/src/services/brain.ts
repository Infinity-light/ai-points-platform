import api from '@/lib/axios';

export interface BrainMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BrainConversation {
  id: string;
  projectId: string;
  messages: BrainMessage[];
  createdAt: string;
  updatedAt: string;
}

export const brainApi = {
  getConversation(projectId: string): Promise<BrainConversation | null> {
    return api.get(`/brain/projects/${projectId}/conversation`).then((r) => r.data).catch(() => null);
  },

  clearConversation(projectId: string): Promise<void> {
    return api.delete(`/brain/projects/${projectId}/conversation`).then(() => undefined);
  },
};

// ── Plugin admin API ────────────────────────────────────────────

export interface BrainPluginTool {
  name: string;
  description: string;
  requiredPermission?: { resource: string; action: string };
}

export interface BrainPluginInfo {
  id: string;
  name: string;
  type: string;
  toolCount: number;
  tools: BrainPluginTool[];
  enabled: boolean;
  config: Record<string, unknown>;
}

export const brainPluginApi = {
  list(): Promise<BrainPluginInfo[]> {
    return api.get('/brain/plugins').then((r) => r.data);
  },

  update(
    pluginId: string,
    body: { enabled?: boolean; config?: Record<string, unknown> },
  ): Promise<void> {
    return api.patch(`/brain/plugins/${encodeURIComponent(pluginId)}`, body).then(() => undefined);
  },

  testTool(
    pluginId: string,
    toolName: string,
    input?: Record<string, unknown>,
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    return api
      .post(`/brain/plugins/${encodeURIComponent(pluginId)}/test`, { toolName, input })
      .then((r) => r.data);
  },
};
