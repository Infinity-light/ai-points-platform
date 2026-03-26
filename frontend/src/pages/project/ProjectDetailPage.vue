<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { projectApi, type Project } from '@/services/project';
import { taskApi, submissionApi, type Task, type TaskStatus, type Submission } from '@/services/task';
import { useAuthStore } from '@/stores/auth';
import BaseButton from '@/components/ui/BaseButton.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import TaskSubmitModal from '@/components/TaskSubmitModal.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const projectId = computed(() => route.params.id as string);

const project = ref<Project | null>(null);
const tasks = ref<Task[]>([]);
const loading = ref(true);
const taskFilter = ref<TaskStatus | 'all'>('all');
const showCreateTask = ref(false);
const newTaskTitle = ref('');
const newTaskPoints = ref<number | null>(null);
const createLoading = ref(false);

// Side panel + submit modal state
const selectedTask = ref<Task | null>(null);
const showSubmitModal = ref(false);
const taskSubmissions = ref<Submission[]>([]);
const loadingSubmissions = ref(false);

async function load() {
  try {
    const [projRes, taskRes] = await Promise.all([
      projectApi.get(projectId.value),
      taskApi.list(projectId.value),
    ]);
    project.value = projRes.data;
    tasks.value = taskRes.data;
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const filteredTasks = computed(() => {
  if (taskFilter.value === 'all') return tasks.value;
  return tasks.value.filter((t) => t.status === taskFilter.value);
});

async function createTask() {
  if (!newTaskTitle.value.trim()) return;
  createLoading.value = true;
  try {
    const res = await taskApi.create(projectId.value, {
      title: newTaskTitle.value.trim(),
      estimatedPoints: newTaskPoints.value ?? undefined,
    });
    tasks.value.unshift(res.data);
    newTaskTitle.value = '';
    newTaskPoints.value = null;
    showCreateTask.value = false;
  } catch {
    // ignore
  } finally {
    createLoading.value = false;
  }
}

async function claimTask(task: Task) {
  try {
    const res = await taskApi.transition(projectId.value, task.id, 'claimed');
    const idx = tasks.value.findIndex((t) => t.id === task.id);
    if (idx !== -1) tasks.value[idx] = res.data;
  } catch {
    // ignore
  }
}

async function selectTask(task: Task) {
  selectedTask.value = task;
  loadingSubmissions.value = true;
  try {
    const res = await submissionApi.listByTask(task.id);
    taskSubmissions.value = res.data;
  } catch {
    taskSubmissions.value = [];
  } finally {
    loadingSubmissions.value = false;
  }
}

function openSubmitModal(task: Task, event: Event) {
  event.stopPropagation();
  selectedTask.value = task;
  showSubmitModal.value = true;
}

async function onSubmitted() {
  await load();
  if (selectedTask.value) await selectTask(selectedTask.value);
}

const aiScoreLabels: Record<string, string> = { research: '调查', planning: '规划', execution: '执行' };

const filterOptions: Array<{ value: TaskStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '待认领' },
  { value: 'claimed', label: '进行中' },
  { value: 'submitted', label: '已提交' },
  { value: 'ai_reviewing', label: 'AI审中' },
  { value: 'pending_vote', label: '待投票' },
  { value: 'settled', label: '已固化' },
];

const reviewStatusLabel: Record<Submission['aiReviewStatus'], string> = {
  pending: '待评审',
  processing: 'AI评审中',
  completed: '评审完成',
  failed: '评审失败',
};
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="h-8 bg-muted rounded w-1/3 animate-pulse" />
      <div class="h-4 bg-muted rounded w-1/2 animate-pulse" />
    </div>

    <template v-else-if="project">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-3">
          <button class="text-muted-foreground hover:text-foreground transition-colors" @click="router.push('/projects')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-foreground">{{ project.name }}</h1>
            <p v-if="project.description" class="text-sm text-muted-foreground mt-0.5">{{ project.description }}</p>
          </div>
        </div>
        <div class="flex gap-2 items-center">
          <span class="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
            第 {{ project.settlementRound }} 轮
          </span>
          <router-link
            :to="`/projects/${projectId}/brain`"
            class="inline-flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors px-3 py-1 rounded-full font-medium"
          >
            <span class="text-sm leading-none">&#129504;</span>
            智脑
          </router-link>
        </div>
      </div>

      <!-- Task table + side panel flex container -->
      <div class="flex gap-4 items-start">
        <!-- Task table section -->
        <div class="flex-1 min-w-0 bg-card border border-border rounded-lg">
          <!-- Table header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-border">
            <div class="flex items-center gap-2 overflow-x-auto">
              <button
                v-for="opt in filterOptions"
                :key="opt.value"
                class="text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors"
                :class="taskFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                @click="taskFilter = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
            <BaseButton size="sm" @click="showCreateTask = !showCreateTask">
              <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              新任务
            </BaseButton>
          </div>

          <!-- Quick create task row -->
          <div v-if="showCreateTask" class="px-4 py-3 border-b border-border bg-muted/30">
            <div class="flex items-center gap-3">
              <input
                v-model="newTaskTitle"
                placeholder="输入任务标题..."
                class="flex-1 px-3 py-1.5 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                @keyup.enter="createTask"
              />
              <input
                v-model.number="newTaskPoints"
                type="number"
                min="1" max="100"
                placeholder="预估工分"
                class="w-24 px-3 py-1.5 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <BaseButton size="sm" :loading="createLoading" @click="createTask">添加</BaseButton>
              <BaseButton size="sm" variant="ghost" @click="showCreateTask = false; newTaskTitle = ''">取消</BaseButton>
            </div>
          </div>

          <!-- Task rows -->
          <div v-if="filteredTasks.length === 0" class="py-12 text-center text-muted-foreground text-sm">
            {{ taskFilter === 'all' ? '还没有任务，点击「新任务」开始添加' : '此状态下没有任务' }}
          </div>

          <div v-else class="divide-y divide-border">
            <div
              v-for="task in filteredTasks"
              :key="task.id"
              class="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
              :class="{ 'bg-muted/40': selectedTask?.id === task.id }"
              @click="selectTask(task)"
            >
              <!-- Status -->
              <StatusBadge :status="task.status" />

              <!-- Title -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground truncate">{{ task.title }}</p>
                <p v-if="task.description" class="text-xs text-muted-foreground mt-0.5 truncate">
                  {{ task.description }}
                </p>
              </div>

              <!-- AI Score (if exists) -->
              <div v-if="task.metadata?.aiScores" class="text-xs text-muted-foreground flex items-center gap-1">
                <span class="text-primary font-medium">{{ task.metadata.aiScores.average.toFixed(1) }}/5</span>
                <span>AI分</span>
              </div>

              <!-- Points -->
              <div class="text-xs text-muted-foreground w-16 text-right">
                <span v-if="task.metadata?.finalPoints" class="text-green-600 font-medium">
                  {{ task.metadata.finalPoints }}分
                </span>
                <span v-else-if="task.estimatedPoints" class="text-muted-foreground">
                  ~{{ task.estimatedPoints }}分
                </span>
              </div>

              <!-- Action -->
              <div class="w-28 flex justify-end gap-1.5">
                <BaseButton
                  v-if="task.status === 'open'"
                  size="sm"
                  variant="outline"
                  @click.stop="claimTask(task)"
                >
                  认领
                </BaseButton>
                <BaseButton
                  v-if="task.status === 'claimed' && task.assigneeId === authStore.user?.id"
                  size="sm"
                  @click="openSubmitModal(task, $event)"
                >
                  提交
                </BaseButton>
                <span
                  v-else-if="task.status !== 'open' && task.assigneeId === authStore.user?.id"
                  class="text-xs text-primary font-medium self-center"
                >
                  我负责
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Side panel -->
        <div
          v-if="selectedTask"
          class="w-80 shrink-0 border border-border rounded-lg bg-card overflow-auto"
          style="max-height: calc(100vh - 12rem);"
        >
          <div class="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
            <h3 class="font-medium text-sm text-foreground">任务详情</h3>
            <button class="text-muted-foreground hover:text-foreground" @click="selectedTask = null">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-4 space-y-4">
            <!-- Title & description -->
            <div>
              <p class="text-sm font-semibold text-foreground">{{ selectedTask.title }}</p>
              <p v-if="selectedTask.description" class="text-xs text-muted-foreground mt-1">{{ selectedTask.description }}</p>
            </div>

            <!-- AI Scores -->
            <div v-if="selectedTask.metadata?.aiScores" class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI 评分</p>
              <div
                v-for="(label, key) in aiScoreLabels"
                :key="key"
                class="space-y-0.5"
              >
                <div class="flex justify-between text-xs">
                  <span class="text-muted-foreground">{{ label }}</span>
                  <span class="font-medium">
                    {{ selectedTask.metadata.aiScores[key as keyof typeof selectedTask.metadata.aiScores] }}/5
                  </span>
                </div>
                <div class="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    class="h-full bg-primary rounded-full transition-all"
                    :style="{ width: `${(Number(selectedTask.metadata.aiScores[key as keyof typeof selectedTask.metadata.aiScores]) / 5) * 100}%` }"
                  />
                </div>
              </div>
              <div class="text-xs text-muted-foreground pt-1">
                平均：<span class="font-medium text-foreground">{{ selectedTask.metadata.aiScores.average.toFixed(1) }}/5</span>
              </div>
            </div>

            <!-- Submissions -->
            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">提交记录</p>
              <div v-if="loadingSubmissions" class="text-xs text-muted-foreground">加载中...</div>
              <div v-else-if="taskSubmissions.length === 0" class="text-xs text-muted-foreground">暂无提交记录</div>
              <div
                v-for="sub in taskSubmissions"
                :key="sub.id"
                class="bg-muted/50 rounded-md p-2 text-xs space-y-1"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium capitalize">{{ sub.type }}</span>
                  <span
                    class="px-1.5 py-0.5 rounded text-xs"
                    :class="{
                      'bg-amber-100 text-amber-700': sub.aiReviewStatus === 'pending',
                      'bg-blue-100 text-blue-700': sub.aiReviewStatus === 'processing',
                      'bg-green-100 text-green-700': sub.aiReviewStatus === 'completed',
                      'bg-red-100 text-red-600': sub.aiReviewStatus === 'failed',
                    }"
                  >
                    {{ reviewStatusLabel[sub.aiReviewStatus] }}
                  </span>
                </div>
                <p class="text-muted-foreground line-clamp-2">{{ sub.content }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- Submit modal -->
  <TaskSubmitModal
    v-if="selectedTask"
    :task="selectedTask"
    :open="showSubmitModal"
    @close="showSubmitModal = false"
    @submitted="onSubmitted"
  />
</template>
