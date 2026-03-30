<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/lib/axios';
import { Send, Loader2, Brain } from 'lucide-vue-next';

const route = useRoute();
const projectId = computed(() => route.params.id as string);

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface TaskSuggestion {
  title: string;
  description: string;
  estimatedPoints: number;
}

const messages = ref<Message[]>([]);
const inputText = ref('');
const isStreaming = ref(false);
const conversationId = ref<string | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);
const pendingTasks = ref<TaskSuggestion[]>([]);
const showTaskConfirm = ref(false);
const isConfirmingTasks = ref(false);

onMounted(async () => {
  // load existing conversation if any
  try {
    const res = await api.get(`/brain/projects/${projectId.value}/conversation`);
    if (res.data) {
      conversationId.value = res.data.id;
      messages.value = res.data.messages || [];
    }
  } catch {
    // no conversation yet, start fresh
  }
  scrollToBottom();
});

async function scrollToBottom() {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;

  inputText.value = '';
  messages.value.push({ role: 'user', content: text });

  const assistantMsg: Message = { role: 'assistant', content: '', isStreaming: true };
  messages.value.push(assistantMsg);

  isStreaming.value = true;
  scrollToBottom();

  try {
    const token = localStorage.getItem('access_token');
    // api.defaults.baseURL is '/api' (relative), resolve against current origin
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
          } else if (event.type === 'task_suggestion' && event.tasks?.length) {
            pendingTasks.value = event.tasks;
            showTaskConfirm.value = true;
          } else if (event.type === 'conversation_id') {
            conversationId.value = event.conversationId;
          } else if (event.type === 'done') {
            done = true;
            break;
          }
        } catch {
          // ignore parse errors for individual SSE events
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

async function confirmTasks() {
  isConfirmingTasks.value = true;
  try {
    await api.post(`/brain/projects/${projectId.value}/confirm-tasks`, {
      tasks: pendingTasks.value,
      conversationId: conversationId.value,
    });
    showTaskConfirm.value = false;
    messages.value.push({
      role: 'assistant',
      content: `已成功创建 ${pendingTasks.value.length} 个任务`,
    });
    pendingTasks.value = [];
  } catch {
    // handle error silently
  } finally {
    isConfirmingTasks.value = false;
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
        <div>
          <h2 class="text-lg font-heading font-semibold text-foreground">项目智脑</h2>
          <p class="text-sm text-muted-foreground">你的 AI 项目管理助手，可以读取任务表、分析进度、生成新任务</p>
        </div>
      </div>
    </div>

    <!-- Messages area -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      <!-- Welcome message if empty -->
      <div v-if="messages.length === 0" class="text-center py-12">
        <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="text-3xl">&#129504;</span>
        </div>
        <h3 class="text-lg font-heading font-medium text-foreground mb-2">项目智脑已就绪</h3>
        <p class="text-muted-foreground text-sm max-w-sm mx-auto">
          你可以问我关于项目进度、任务分配、工分分析的问题，或者让我帮你生成新的任务。
        </p>
        <div class="mt-6 flex flex-wrap gap-2 justify-center">
          <button
            v-for="prompt in ['分析当前项目进度', '有哪些任务没人认领？', '帮我生成三个新任务', '本周工分分布如何？']"
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
            'max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
            msg.role === 'user'
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'glass-card text-foreground rounded-tl-sm',
          ]"
        >
          <span class="whitespace-pre-wrap">{{ msg.content }}</span>
          <span
            v-if="msg.isStreaming"
            class="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-pulse align-text-bottom"
          ></span>
        </div>
      </div>
    </div>

    <!-- Task suggestion confirmation panel -->
    <div
      v-if="showTaskConfirm"
      class="mx-6 mb-4 glass-card p-4"
    >
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-heading font-semibold text-foreground">智脑建议创建以下任务</h3>
        <button @click="showTaskConfirm = false" class="text-muted-foreground hover:text-foreground text-lg leading-none cursor-pointer transition-colors duration-200">
          &times;
        </button>
      </div>
      <div class="space-y-2 mb-4">
        <div
          v-for="(task, idx) in pendingTasks"
          :key="idx"
          class="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg"
        >
          <span
            class="flex-shrink-0 w-5 h-5 bg-primary/10 text-primary rounded-full text-xs flex items-center justify-center font-mono font-bold mt-0.5"
          >
            {{ idx + 1 }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-foreground">{{ task.title }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ task.description }}</p>
          </div>
          <span class="flex-shrink-0 text-xs font-mono text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
            {{ task.estimatedPoints }} 分
          </span>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          @click="confirmTasks"
          :disabled="isConfirmingTasks"
          class="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200 cursor-pointer"
        >
          {{ isConfirmingTasks ? '创建中...' : '确认创建任务' }}
        </button>
        <button
          @click="showTaskConfirm = false"
          class="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-white/5 hover:text-foreground transition-colors duration-200 cursor-pointer"
        >
          忽略
        </button>
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
      <p class="text-xs text-muted-foreground mt-2">智脑可以访问项目任务表，帮你分析和管理任务</p>
    </div>
  </div>
</template>
