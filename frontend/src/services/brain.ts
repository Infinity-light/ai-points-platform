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

export interface TaskSuggestion {
  title: string;
  description: string;
  estimatedPoints: number;
}

export interface BrainChatResponse {
  conversationId: string;
  content: string;
}

export const brainApi = {
  // Get or create conversation for project
  getConversation(projectId: string): Promise<BrainConversation | null> {
    return api.get(`/brain/projects/${projectId}/conversation`).then((r) => r.data).catch(() => null);
  },

  // Parse task suggestions from content (if backend sends structured suggestions)
  parseTaskSuggestions(content: string): TaskSuggestion[] {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.tasks) return parsed.tasks;
      } catch {
        // ignore parse errors
      }
    }
    return [];
  },

  // Confirm and create task suggestions
  confirmTaskSuggestions(projectId: string, tasks: TaskSuggestion[], conversationId: string): Promise<void> {
    return api
      .post(`/brain/projects/${projectId}/confirm-tasks`, { tasks, conversationId })
      .then(() => undefined);
  },
};
