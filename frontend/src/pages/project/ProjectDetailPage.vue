<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { projectApi, type Project } from '@/services/project';
import { taskApi, submissionApi, type Task, type TaskStatus, type Submission } from '@/services/task';
import { dividendApi, type Dividend } from '@/services/dividend';
import { skillApi, type Skill } from '@/services/skill';
import { pointsApi, type PointsTableRow } from '@/services/points';
import { useAuthStore } from '@/stores/auth';
import BaseButton from '@/components/ui/BaseButton.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import TaskSubmitModal from '@/components/TaskSubmitModal.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const projectId = computed(() => route.params.id as string);

// ─── Tab 状态 ────────────────────────────────────────────────────────────────
type TabKey = 'tasks' | 'points' | 'dividends' | 'skills';
const activeTab = ref<TabKey>('tasks');

// ─── 通用 ────────────────────────────────────────────────────────────────────
const project = ref<Project | null>(null);
const loading = ref(true);

// ─── 任务 Tab ────────────────────────────────────────────────────────────────
const tasks = ref<Task[]>([]);
const taskFilter = ref<TaskStatus | 'all'>('all');
const showCreateTask = ref(false);
const newTaskTitle = ref('');
const newTaskPoints = ref<number | null>(null);
const createLoading = ref(false);
const selectedTask = ref<Task | null>(null);
const showSubmitModal = ref(false);
const taskSubmissions = ref<Submission[]>([]);
const loadingSubmissions = ref(false);

// ─── 公分表 Tab ──────────────────────────────────────────────────────────────
const pointsRows = ref<PointsTableRow[]>([]);
const pointsTotalActive = ref(0);
const pointsTotalOriginal = ref(0);
const pointsLoading = ref(false);
const pointsError = ref('');

// ─── 分红 Tab ────────────────────────────────────────────────────────────────
const dividends = ref<Dividend[]>([]);
const dividendsLoading = ref(false);
const dividendsError = ref('');
const expandedDividendId = ref<string | null>(null);
const dividendDetail = ref<Dividend | null>(null);
const dividendDetailLoading = ref(false);
const showFillAmountModal = ref(false);
const fillAmountTarget = ref<Dividend | null>(null);
const fillAmountValue = ref<number | null>(null);
const fillAmountLoading = ref(false);
const fillAmountError = ref('');

// ─── Skill Tab ───────────────────────────────────────────────────────────────
const skills = ref<Skill[]>([]);
const skillsLoading = ref(false);
const skillsError = ref('');
const selectedSkill = ref<Skill | null>(null);
const skillDetailLoading = ref(false);

// ─── 初始化加载 ──────────────────────────────────────────────────────────────
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

// ─── Tab 切换懒加载 ──────────────────────────────────────────────────────────
watch(activeTab, (tab) => {
  if (tab === 'points' && pointsRows.value.length === 0 && !pointsLoading.value) {
    loadPointsTable();
  }
  if (tab === 'dividends' && dividends.value.length === 0 && !dividendsLoading.value) {
    loadDividends();
  }
  if (tab === 'skills' && skills.value.length === 0 && !skillsLoading.value) {
    loadSkills();
  }
});

// ─── 任务功能 ────────────────────────────────────────────────────────────────
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

// ─── 公分表功能 ──────────────────────────────────────────────────────────────
async function loadPointsTable() {
  pointsLoading.value = true;
  pointsError.value = '';
  try {
    const res = await pointsApi.getProjectPointsTable(projectId.value);
    pointsRows.value = res.data.rows;
    pointsTotalActive.value = res.data.totalActive;
    pointsTotalOriginal.value = res.data.totalOriginal;
  } catch {
    pointsError.value = '加载公分表失败，请刷新重试';
  } finally {
    pointsLoading.value = false;
  }
}

const overallActivityRatio = computed(() =>
  pointsTotalOriginal.value > 0
    ? pointsTotalActive.value / pointsTotalOriginal.value
    : 0,
);

// ─── 分红功能 ────────────────────────────────────────────────────────────────
async function loadDividends() {
  dividendsLoading.value = true;
  dividendsError.value = '';
  try {
    const res = await dividendApi.listForProject(projectId.value);
    dividends.value = res.data;
  } catch {
    dividendsError.value = '加载分红记录失败，请刷新重试';
  } finally {
    dividendsLoading.value = false;
  }
}

async function toggleDividendDetail(dividend: Dividend) {
  if (expandedDividendId.value === dividend.id) {
    expandedDividendId.value = null;
    dividendDetail.value = null;
    return;
  }
  expandedDividendId.value = dividend.id;
  dividendDetailLoading.value = true;
  try {
    const res = await dividendApi.get(dividend.id);
    dividendDetail.value = res.data;
  } catch {
    dividendDetail.value = null;
  } finally {
    dividendDetailLoading.value = false;
  }
}

function openFillAmountModal(dividend: Dividend, event: Event) {
  event.stopPropagation();
  fillAmountTarget.value = dividend;
  fillAmountValue.value = null;
  fillAmountError.value = '';
  showFillAmountModal.value = true;
}

async function submitFillAmount() {
  if (!fillAmountTarget.value || !fillAmountValue.value || fillAmountValue.value <= 0) {
    fillAmountError.value = '请输入有效金额';
    return;
  }
  fillAmountLoading.value = true;
  fillAmountError.value = '';
  try {
    const res = await dividendApi.fillAmount(fillAmountTarget.value.id, fillAmountValue.value);
    const idx = dividends.value.findIndex((d) => d.id === fillAmountTarget.value!.id);
    if (idx !== -1) dividends.value[idx] = res.data;
    showFillAmountModal.value = false;
    fillAmountTarget.value = null;
  } catch {
    fillAmountError.value = '填入失败，请重试';
  } finally {
    fillAmountLoading.value = false;
  }
}

const isHrAdminOrAbove = computed(() =>
  ['hr_admin', 'super_admin'].includes(authStore.user?.role ?? ''),
);

async function approveDividend(dividend: Dividend, event: Event) {
  event.stopPropagation();
  try {
    const res = await dividendApi.approve(dividend.id);
    const idx = dividends.value.findIndex((d) => d.id === dividend.id);
    if (idx !== -1) dividends.value[idx] = res.data;
    if (dividendDetail.value?.id === dividend.id) dividendDetail.value = res.data;
  } catch {
    dividendsError.value = '审批失败，请重试';
  }
}

async function rejectDividend(dividend: Dividend, event: Event) {
  event.stopPropagation();
  try {
    const res = await dividendApi.reject(dividend.id);
    const idx = dividends.value.findIndex((d) => d.id === dividend.id);
    if (idx !== -1) dividends.value[idx] = res.data;
    if (dividendDetail.value?.id === dividend.id) dividendDetail.value = res.data;
  } catch {
    dividendsError.value = '驳回失败，请重试';
  }
}

// ─── Skill 功能 ──────────────────────────────────────────────────────────────
async function loadSkills() {
  skillsLoading.value = true;
  skillsError.value = '';
  try {
    const res = await skillApi.listForProject(projectId.value);
    skills.value = res.data;
  } catch {
    skillsError.value = '加载 Skill 失败，请刷新重试';
  } finally {
    skillsLoading.value = false;
  }
}

async function openSkillDetail(skill: Skill) {
  selectedSkill.value = skill;
  skillDetailLoading.value = true;
  try {
    const res = await skillApi.get(skill.id);
    selectedSkill.value = res.data;
  } catch {
    // keep the list item data
  } finally {
    skillDetailLoading.value = false;
  }
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const dividendStatusConfig: Record<
  Dividend['status'],
  { label: string; class: string }
> = {
  draft: { label: '草稿', class: 'bg-gray-100 text-gray-600' },
  pending_approval: { label: '待审批', class: 'bg-amber-100 text-amber-700' },
  approved: { label: '已审批', class: 'bg-green-100 text-green-700' },
  rejected: { label: '已驳回', class: 'bg-red-100 text-red-600' },
};

const aiScoreLabels: Record<string, string> = {
  research: '调查',
  planning: '规划',
  execution: '执行',
};

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

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: 'tasks', label: '任务' },
  { key: 'points', label: '公分表' },
  { key: 'dividends', label: '分红' },
  { key: 'skills', label: 'Skill' },
];
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
          <button
            class="text-muted-foreground hover:text-foreground transition-colors"
            @click="router.push('/projects')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-foreground">{{ project.name }}</h1>
            <p v-if="project.description" class="text-sm text-muted-foreground mt-0.5">
              {{ project.description }}
            </p>
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

      <!-- Tabs -->
      <div class="border-b border-border mb-6">
        <nav class="flex gap-6">
          <button
            v-for="tab in tabDefs"
            :key="tab.key"
            class="pb-3 text-sm font-medium transition-colors border-b-2 -mb-px"
            :class="
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            "
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- ── 任务 Tab ──────────────────────────────────────────────────────── -->
      <div v-if="activeTab === 'tasks'" class="flex gap-4 items-start">
        <!-- Task table section -->
        <div class="flex-1 min-w-0 bg-card border border-border rounded-lg">
          <!-- Table header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-border">
            <div class="flex items-center gap-2 overflow-x-auto">
              <button
                v-for="opt in filterOptions"
                :key="opt.value"
                class="text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors"
                :class="
                  taskFilter === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                "
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
                min="1"
                max="100"
                placeholder="预估工分"
                class="w-24 px-3 py-1.5 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <BaseButton size="sm" :loading="createLoading" @click="createTask">添加</BaseButton>
              <BaseButton
                size="sm"
                variant="ghost"
                @click="showCreateTask = false; newTaskTitle = ''"
              >
                取消
              </BaseButton>
            </div>
          </div>

          <!-- Task rows -->
          <div
            v-if="filteredTasks.length === 0"
            class="py-12 text-center text-muted-foreground text-sm"
          >
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
              <StatusBadge :status="task.status" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground truncate">{{ task.title }}</p>
                <p v-if="task.description" class="text-xs text-muted-foreground mt-0.5 truncate">
                  {{ task.description }}
                </p>
              </div>
              <div
                v-if="task.metadata?.aiScores"
                class="text-xs text-muted-foreground flex items-center gap-1"
              >
                <span class="text-primary font-medium">
                  {{ task.metadata.aiScores.average.toFixed(1) }}/5
                </span>
                <span>AI分</span>
              </div>
              <div class="text-xs text-muted-foreground w-16 text-right">
                <span v-if="task.metadata?.finalPoints" class="text-green-600 font-medium">
                  {{ task.metadata.finalPoints }}分
                </span>
                <span v-else-if="task.estimatedPoints" class="text-muted-foreground">
                  ~{{ task.estimatedPoints }}分
                </span>
              </div>
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
          <div
            class="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10"
          >
            <h3 class="font-medium text-sm text-foreground">任务详情</h3>
            <button
              class="text-muted-foreground hover:text-foreground"
              @click="selectedTask = null"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="p-4 space-y-4">
            <div>
              <p class="text-sm font-semibold text-foreground">{{ selectedTask.title }}</p>
              <p v-if="selectedTask.description" class="text-xs text-muted-foreground mt-1">
                {{ selectedTask.description }}
              </p>
            </div>
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
                    :style="{
                      width: `${(Number(selectedTask.metadata.aiScores[key as keyof typeof selectedTask.metadata.aiScores]) / 5) * 100}%`,
                    }"
                  />
                </div>
              </div>
              <div class="text-xs text-muted-foreground pt-1">
                平均：
                <span class="font-medium text-foreground">
                  {{ selectedTask.metadata.aiScores.average.toFixed(1) }}/5
                </span>
              </div>
            </div>
            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">提交记录</p>
              <div v-if="loadingSubmissions" class="text-xs text-muted-foreground">加载中...</div>
              <div
                v-else-if="taskSubmissions.length === 0"
                class="text-xs text-muted-foreground"
              >
                暂无提交记录
              </div>
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

      <!-- ── 公分表 Tab ─────────────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'points'">
        <div v-if="pointsLoading" class="space-y-2">
          <div v-for="i in 5" :key="i" class="h-12 bg-muted rounded animate-pulse" />
        </div>
        <div
          v-else-if="pointsError"
          class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
        >
          {{ pointsError }}
        </div>
        <template v-else>
          <!-- 整体摘要 -->
          <div class="bg-card border border-border rounded-lg p-4 mb-4 flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">整体工分活跃度</p>
              <p class="text-xs text-muted-foreground mt-0.5">
                活跃 {{ pointsTotalActive }} / 历史 {{ pointsTotalOriginal }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-32 h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full transition-all"
                  :style="{ width: `${overallActivityRatio * 100}%` }"
                />
              </div>
              <span class="text-sm font-medium text-foreground">
                {{ (overallActivityRatio * 100).toFixed(0) }}%
              </span>
            </div>
          </div>

          <!-- 排行表 -->
          <div
            v-if="pointsRows.length === 0"
            class="py-12 text-center text-muted-foreground text-sm"
          >
            暂无工分数据
          </div>
          <div v-else class="bg-card border border-border rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-muted-foreground">
                  <th class="px-4 py-3 font-medium">排名</th>
                  <th class="px-4 py-3 font-medium">成员</th>
                  <th class="px-4 py-3 font-medium text-right">历史工分</th>
                  <th class="px-4 py-3 font-medium text-right">活跃工分</th>
                  <th class="px-4 py-3 font-medium w-48">占比</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr
                  v-for="(row, index) in pointsRows"
                  :key="row.userId"
                  class="hover:bg-accent/30 transition-colors"
                >
                  <td class="px-4 py-3 text-muted-foreground font-medium">
                    {{ index + 1 }}
                  </td>
                  <td class="px-4 py-3 font-medium text-foreground">{{ row.userName }}</td>
                  <td class="px-4 py-3 text-right text-muted-foreground">{{ row.originalTotal }}</td>
                  <td class="px-4 py-3 text-right font-medium text-primary">{{ row.activeTotal }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          class="h-full bg-primary rounded-full"
                          :style="{ width: `${row.ratio * 100}%` }"
                        />
                      </div>
                      <span class="text-xs text-muted-foreground w-12 text-right">
                        {{ (row.ratio * 100).toFixed(1) }}%
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <!-- ── 分红 Tab ───────────────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'dividends'">
        <div v-if="dividendsLoading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="h-16 bg-muted rounded animate-pulse" />
        </div>
        <div
          v-else-if="dividendsError"
          class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
        >
          {{ dividendsError }}
        </div>
        <div
          v-else-if="dividends.length === 0"
          class="py-12 text-center text-muted-foreground text-sm"
        >
          暂无分红记录
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="dividend in dividends"
            :key="dividend.id"
            class="bg-card border border-border rounded-lg overflow-hidden"
          >
            <!-- 分红行 -->
            <div
              class="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              @click="toggleDividendDetail(dividend)"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-foreground">
                    第 {{ dividend.roundNumber }} 期分红
                  </span>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    :class="dividendStatusConfig[dividend.status].class"
                  >
                    {{ dividendStatusConfig[dividend.status].label }}
                  </span>
                </div>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {{ formatDateTime(dividend.createdAt) }}
                </p>
              </div>

              <!-- 金额 -->
              <div class="text-right">
                <p class="text-sm font-medium text-foreground">
                  {{
                    dividend.totalAmount !== null
                      ? `¥ ${dividend.totalAmount.toLocaleString()}`
                      : '待填入'
                  }}
                </p>
                <p class="text-xs text-muted-foreground">
                  总活跃 {{ dividend.totalActivePoints }} 分
                </p>
              </div>

              <!-- 操作按钮 -->
              <div class="flex gap-2" @click.stop>
                <BaseButton
                  v-if="dividend.status === 'draft'"
                  size="sm"
                  variant="outline"
                  @click="openFillAmountModal(dividend, $event)"
                >
                  填入金额
                </BaseButton>
                <template
                  v-if="dividend.status === 'pending_approval' && isHrAdminOrAbove"
                >
                  <BaseButton
                    size="sm"
                    @click="approveDividend(dividend, $event)"
                  >
                    审批通过
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="outline"
                    @click="rejectDividend(dividend, $event)"
                  >
                    驳回
                  </BaseButton>
                </template>
              </div>

              <!-- 展开箭头 -->
              <svg
                class="w-4 h-4 text-muted-foreground transition-transform"
                :class="expandedDividendId === dividend.id ? 'rotate-180' : ''"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            <!-- 展开详情 -->
            <div
              v-if="expandedDividendId === dividend.id"
              class="border-t border-border px-4 py-3"
            >
              <div v-if="dividendDetailLoading" class="space-y-2">
                <div v-for="i in 3" :key="i" class="h-8 bg-muted rounded animate-pulse" />
              </div>
              <div v-else-if="dividendDetail">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-muted-foreground border-b border-border">
                      <th class="pb-2 font-medium">成员</th>
                      <th class="pb-2 font-medium text-right">活跃工分</th>
                      <th class="pb-2 font-medium text-right">占比</th>
                      <th class="pb-2 font-medium text-right">分红金额</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr
                      v-for="(entry, userId) in dividendDetail.details"
                      :key="userId"
                      class="hover:bg-muted/20"
                    >
                      <td class="py-2 font-medium text-foreground">{{ entry.userName }}</td>
                      <td class="py-2 text-right text-muted-foreground">{{ entry.activePoints }}</td>
                      <td class="py-2 text-right text-muted-foreground">
                        {{ (entry.ratio * 100).toFixed(1) }}%
                      </td>
                      <td class="py-2 text-right font-medium text-foreground">
                        {{
                          entry.amount !== null
                            ? `¥ ${entry.amount.toLocaleString()}`
                            : '—'
                        }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="text-xs text-muted-foreground py-2">加载详情失败</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Skill Tab ──────────────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'skills'">
        <div v-if="skillsLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 6" :key="i" class="h-32 bg-muted rounded-lg animate-pulse" />
        </div>
        <div
          v-else-if="skillsError"
          class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
        >
          {{ skillsError }}
        </div>
        <div
          v-else-if="skills.length === 0"
          class="py-12 text-center text-muted-foreground text-sm"
        >
          暂无 Skill，提交探索类任务时可自动注册 Skill
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="skill in skills"
            :key="skill.id"
            class="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
            @click="openSkillDetail(skill)"
          >
            <div class="flex items-start justify-between gap-2 mb-2">
              <h3 class="font-medium text-sm text-foreground line-clamp-1">{{ skill.name }}</h3>
              <span class="shrink-0 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                v{{ skill.version }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground line-clamp-2 mb-3">{{ skill.description }}</p>
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded text-xs"
                :class="
                  skill.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                "
              >
                {{ skill.status === 'active' ? '活跃' : '已弃用' }}
              </span>
              <span>{{ formatDate(skill.updatedAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Skill 详情面板（浮层） -->
        <div
          v-if="selectedSkill"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          @click.self="selectedSkill = null"
        >
          <div class="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
            <div
              class="flex items-center justify-between px-6 py-4 border-b border-border"
            >
              <div class="flex items-center gap-3">
                <h2 class="font-semibold text-foreground">{{ selectedSkill.name }}</h2>
                <span class="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">
                  v{{ selectedSkill.version }}
                </span>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs"
                  :class="
                    selectedSkill.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  "
                >
                  {{ selectedSkill.status === 'active' ? '活跃' : '已弃用' }}
                </span>
              </div>
              <button
                class="text-muted-foreground hover:text-foreground transition-colors"
                @click="selectedSkill = null"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div class="px-6 py-4 max-h-[70vh] overflow-y-auto space-y-4">
              <div v-if="skillDetailLoading" class="space-y-3">
                <div class="h-4 bg-muted rounded animate-pulse" />
                <div class="h-4 bg-muted rounded w-2/3 animate-pulse" />
              </div>
              <template v-else>
                <p class="text-sm text-muted-foreground">{{ selectedSkill.description }}</p>

                <div v-if="selectedSkill.repoUrl" class="flex items-center gap-2">
                  <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <a
                    :href="selectedSkill.repoUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-primary hover:underline truncate"
                  >
                    {{ selectedSkill.repoUrl }}
                  </a>
                </div>

                <div v-if="selectedSkill.content">
                  <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Skill 内容
                  </p>
                  <pre class="bg-muted/50 rounded-lg p-3 text-xs text-foreground overflow-x-auto whitespace-pre-wrap">{{ selectedSkill.content }}</pre>
                </div>

                <div class="text-xs text-muted-foreground pt-2 border-t border-border">
                  最后更新：{{ formatDateTime(selectedSkill.updatedAt) }}
                </div>
              </template>
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

  <!-- Fill Amount Modal -->
  <div
    v-if="showFillAmountModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    @click.self="showFillAmountModal = false"
  >
    <div class="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
      <h3 class="font-semibold text-foreground mb-4">
        填入分红金额 — 第 {{ fillAmountTarget?.roundNumber }} 期
      </h3>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-muted-foreground mb-1">总分红金额（元）</label>
          <input
            v-model.number="fillAmountValue"
            type="number"
            min="0"
            step="0.01"
            placeholder="请输入金额..."
            class="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <p v-if="fillAmountError" class="text-xs text-destructive">{{ fillAmountError }}</p>
      </div>
      <div class="flex gap-2 mt-4">
        <BaseButton class="flex-1" :loading="fillAmountLoading" @click="submitFillAmount">
          确认
        </BaseButton>
        <BaseButton variant="outline" class="flex-1" @click="showFillAmountModal = false">
          取消
        </BaseButton>
      </div>
    </div>
  </div>
</template>
