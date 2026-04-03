<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/lib/axios';
import { brainApi } from '@/services/brain';
import { Send, Loader2, Brain, Trash2 } from 'lucide-vue-next';
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';
import ToolCallCard from '@/components/ToolCallCard.vue';

const route = useRoute();
const projectId = computed(() => route.params.id as string);

interface ToolCallInfo {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'done' | 'error';
  error?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
}

const messages = ref<Message[]>([]);
const inputText = ref('');
const isStreaming = ref(false);
const conversationId = ref<string | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);

onMounted(async () => {
  try {
    const conv = await brainApi.getConversation(projectId.value);
    if (conv) {
      conversationId.value = conv.id;
      messages.value = (conv.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }
  } catch {
    // no conversation yet
  }
  scrollToBottom();
});

async function scrollToBottom() {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

async function clearConversation() {
  try {
    await brainApi.clearConversation(projectId.value);
    messages.value = [];
    conversationId.value = null;
  } catch {
    // ignore
  }
}

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;

  inputText.value = '';
  messages.value.push({ role: 'user', content: text });

  const assistantMsg: Message = {
    role: 'assistant',
    content: '',
    isStreaming: true,
    toolCalls: [],
  };
  messages.value.push(assistantMsg);

  isStreaming.value = true;
  scrollToBottom();

  try {
    const token = localStorage.getItem('access_token');
    const baseURL = api.defaults.baseURL?.startsWith('http')
      ? api.defaults.baseURL
      : `${window.location.origin}${api.defaults.baseURL ?? ''}`;

    const response = await fetch(`${baseURL}/brain/projects/${projectId.value}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: text,
        ...(conversationId.value ? { conversationId: conversationId.value } : {}),
      }),
    });

    if (!response.ok || !response.body) {
      assistantMsg.content = '连接失败，请重试';
      assistantMsg.isStreaming = false;
      isStreaming.value = false;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;

    while (!done) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);

          if (event.type === 'delta') {
            assistantMsg.content += event.content;
            scrollToBottom();
          } else if (event.type === 'tool_call_start') {
            assistantMsg.toolCalls!.push({
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              input: event.input ?? {},
              status: 'pending',
            });
            scrollToBottom();
          } else if (event.type === 'tool_call_result') {
            const tc = assistantMsg.toolCalls!.find(
              (t) => t.toolUseId === event.toolUseId,
            );
            if (tc) {
              tc.result = event.result;
              tc.status = event.status ?? 'done';
              tc.error = event.error;
            }
            scrollToBottom();
          } else if (event.type === 'conversation_id') {
            conversationId.value = event.conversationId;
          } else if (event.type === 'done') {
            done = true;
            break;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  } catch {
    assistantMsg.content = '发送失败，请检查网络连接';
  } finally {
    assistantMsg.isStreaming = false;
    isStreaming.value = false;
    scrollToBottom();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-background">
    <!-- Header -->
    <div class="glass-card border-0 border-b border-border/50 px-6 py-4 flex-shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
          <Brain class="w-4 h-4 text-primary" />
        </div>
        <div class="flex-1">
          <h2 class="text-lg font-heading font-semibold text-foreground">项目智脑</h2>
          <p class="text-sm text-muted-foreground">AI 助手，可以查询任务、工分、成员，创建任务，触发结算等</p>
        </div>
        <button
          v-if="messages.length > 0"
          @click="clearConversation"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
          清空对话
        </button>
      </div>
    </div>

    <!-- Messages area -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      <!-- Welcome message if empty -->
      <div v-if="messages.length === 0" class="text-center py-12">
        <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain class="w-8 h-8 text-primary" />
        </div>
        <h3 class="text-lg font-heading font-medium text-foreground mb-2">项目智脑已就绪</h3>
        <p class="text-muted-foreground text-sm max-w-sm mx-auto">
          智脑可以查询和操作项目数据。试试问我一些问题吧。
        </p>
        <div class="mt-6 flex flex-wrap gap-2 justify-center">
          <button
            v-for="prompt in ['列出所有任务', '工分排行榜', '帮我创建一个新任务', '分析项目进度']"
            :key="prompt"
            @click="inputText = prompt"
            class="px-3 py-1.5 glass-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors duration-200 cursor-pointer"
          >
            {{ prompt }}
          </button>
        </div>
      </div>

      <!-- Message bubbles -->
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row']"
      >
        <!-- Avatar -->
        <div class="flex-shrink-0">
          <div
            v-if="msg.role === 'user'"
            class="w-8 h-8 bg-primary rounded-full flex items-center justify-center"
          >
            <span class="text-primary-foreground text-xs font-bold">我</span>
          </div>
          <div
            v-else
            class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center"
          >
            <Brain class="w-4 h-4 text-primary" />
          </div>
        </div>

        <!-- Bubble -->
        <div
          :class="[
            'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
            msg.role === 'user'
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'glass-card text-foreground rounded-tl-sm',
          ]"
        >
          <!-- User messages: plain text -->
          <span v-if="msg.role === 'user'" class="whitespace-pre-wrap">{{ msg.content }}</span>

          <!-- Assistant messages: Markdown + tool cards -->
          <template v-else>
            <MarkdownRenderer v-if="msg.content" :content="msg.content" />
            <span
              v-if="msg.isStreaming && !msg.content && (!msg.toolCalls || msg.toolCalls.length === 0)"
              class="inline-block w-1.5 h-4 bg-primary/60 animate-pulse"
            ></span>
            <span
              v-if="msg.isStreaming && msg.content"
              class="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-pulse align-text-bottom"
            ></span>

            <!-- Tool call cards -->
            <ToolCallCard
              v-for="tc in msg.toolCalls"
              :key="tc.toolUseId"
              :tool-name="tc.toolName"
              :tool-use-id="tc.toolUseId"
              :input="tc.input"
              :result="tc.result"
              :status="tc.status"
              :error="tc.error"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="border-t border-border/50 px-6 py-4 flex-shrink-0 bg-card/40">
      <div class="flex gap-3 items-end">
        <textarea
          v-model="inputText"
          @keydown="handleKeydown"
          placeholder="输入你的问题... (Enter 发送，Shift+Enter 换行)"
          rows="1"
          :disabled="isStreaming"
          class="flex-1 resize-none border border-border bg-background rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 max-h-32 overflow-y-auto transition-colors duration-200"
          style="min-height: 48px"
        ></textarea>
        <button
          @click="sendMessage"
          :disabled="isStreaming || !inputText.trim()"
          class="flex-shrink-0 w-12 h-12 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-xl flex items-center justify-center transition-colors duration-200 cursor-pointer"
        >
          <Send v-if="!isStreaming" class="w-5 h-5" />
          <Loader2 v-else class="w-5 h-5 animate-spin" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground mt-2">智脑会调用工具获取真实数据来回答你的问题</p>
    </div>
  </div>
</template>
