<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { meetingApi, type ReviewMeeting, type MeetingTaskResult } from '@/services/meeting';
import { taskApi, type Task } from '@/services/task';
import { useAuthStore } from '@/stores/auth';
import { useMeeting, type ContributionEntry } from '@/composables/useMeeting';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle,
  AlertCircle,
  BarChart3,
  X,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const meetingId = route.params.id as string;

// ─── 状态 ────────────────────────────────────────────────────────────────────
const meeting = ref<ReviewMeeting | null>(null);
const tasks = ref<Task[]>([]);
const loading = ref(true);
const error = ref('');
const currentTaskIndex = ref(0);
const showEndConfirm = ref(false);
const endLoading = ref(false);
const isLead = ref(false);

// 投票面板状态
const voteMode = ref<'approval' | 'custom'>('approval');
const customScore = ref<number | null>(null);
const voteLoading = ref(false);
const voteError = ref('');

// 贡献分配状态
const contributionMode = ref(false);
const contributions = ref<ContributionEntry[]>([]);
const contributionSaving = ref(false);

const {
  isConnected,
  focusedTaskId,
  participants,
  taskStats,
  confirmedTasks,
  confirmedResults,
  meetingEnded,
  connect,
  emitFocus,
  emitVote,
  emitContribution,
  emitConfirm,
  emitEnd,
} = useMeeting(meetingId);

// ─── 计算 ────────────────────────────────────────────────────────────────────
const currentTask = computed<Task | null>(() => tasks.value[currentTaskIndex.value] ?? null);

const confirmedCount = computed(() => confirmedTasks.value.size);
const totalTaskCount = computed(() => tasks.value.length);

const progressPercent = computed(() =>
  totalTaskCount.value > 0
    ? Math.round((confirmedCount.value / totalTaskCount.value) * 100)
    : 0,
);

const currentStats = computed(() => {
  if (!currentTask.value) return null;
  return taskStats.value.get(currentTask.value.id) ?? null;
});

const currentResult = computed<MeetingTaskResult | null>(() => {
  if (!currentTask.value) return null;
  return confirmedResults.value.get(currentTask.value.id) ?? meeting.value?.results?.[currentTask.value.id] ?? null;
});

const isCurrentConfirmed = computed(() => {
  if (!currentTask.value) return false;
  return confirmedTasks.value.has(currentTask.value.id);
});

// ─── 加载 ────────────────────────────────────────────────────────────────────
async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [meetingRes] = await Promise.all([meetingApi.get(meetingId)]);
    meeting.value = meetingRes.data;

    // 加载关联的任务
    if (meeting.value.taskIds.length > 0) {
      const projectId = meeting.value.projectId;
      const taskRes = await taskApi.list(projectId);
      const taskMap = new Map(taskRes.data.map((t) => [t.id, t]));
      tasks.value = meeting.value.taskIds
        .map((id) => taskMap.get(id))
        .filter((t): t is Task => !!t);
    }

    // 将已有结果恢复到 confirmedTasks
    if (meeting.value.results) {
      for (const taskId of Object.keys(meeting.value.results)) {
        confirmedTasks.value.add(taskId);
        confirmedResults.value.set(taskId, meeting.value.results[taskId]);
      }
    }

    // 检查当前用户是否为 lead（创建者视为 lead）
    isLead.value = meeting.value.createdBy === authStore.user?.id;

    // 连接 Socket.IO
    if (meeting.value.status === 'open') {
      connect();
    }
  } catch {
    error.value = '加载会议失败，请刷新重试';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// ─── 任务导航 ────────────────────────────────────────────────────────────────
function focusTask(index: number): void {
  currentTaskIndex.value = index;
  const task = tasks.value[index];
  if (task && isLead.value) {
    emitFocus(task.id);
  }
  // 重置投票面板
  voteMode.value = 'approval';
  customScore.value = null;
  voteError.value = '';
  contributionMode.value = false;
}

function prevTask(): void {
  if (currentTaskIndex.value > 0) focusTask(currentTaskIndex.value - 1);
}

function nextTask(): void {
  if (currentTaskIndex.value < tasks.value.length - 1) {
    focusTask(currentTaskIndex.value + 1);
  }
}

// ─── 投票 ────────────────────────────────────────────────────────────────────
async function castVote(): Promise<void> {
  if (!currentTask.value) return;
  if (voteMode.value === 'custom' && (!customScore.value || customScore.value <= 0)) {
    voteError.value = '请输入大于 0 的自定义分数';
    return;
  }
  voteLoading.value = true;
  voteError.value = '';
  try {
    emitVote({
      taskId: currentTask.value.id,
      isApproval: voteMode.value === 'approval',
      score: voteMode.value === 'custom' ? (customScore.value ?? undefined) : undefined,
    });
  } catch {
    voteError.value = '投票失败，请重试';
  } finally {
    voteLoading.value = false;
  }
}

// ─── 确认任务 ────────────────────────────────────────────────────────────────
function confirmAndNext(): void {
  if (!currentTask.value || !isLead.value) return;
  const aiScores = currentTask.value.metadata?.aiScores;
  const aiTotal = aiScores
    ? aiScores.research + aiScores.planning + aiScores.execution
    : 10;

  emitConfirm({
    taskId: currentTask.value.id,
    aiTotalScore: aiTotal,
  });

  // 自动前进到下一个未确认任务
  const nextIndex = tasks.value.findIndex(
    (t, i) => i > currentTaskIndex.value && !confirmedTasks.value.has(t.id),
  );
  if (nextIndex !== -1) {
    focusTask(nextIndex);
  }
}

// ─── 贡献分配 ────────────────────────────────────────────────────────────────
function openContributionPanel(): void {
  if (!currentTask.value) return;
  contributionMode.value = true;
  // 默认100%给 assignee
  const assigneeId = currentTask.value.assigneeId;
  contributions.value = assigneeId
    ? [{ userId: assigneeId, percentage: 100 }]
    : [];
}

function addContributor(): void {
  contributions.value.push({ userId: '', percentage: 0 });
}

function removeContributor(index: number): void {
  contributions.value.splice(index, 1);
}

async function saveContributions(): Promise<void> {
  if (!currentTask.value) return;
  const total = contributions.value.reduce((s, c) => s + c.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    voteError.value = `贡献比例之和必须为 100%，当前为 ${total}%`;
    return;
  }
  contributionSaving.value = true;
  try {
    emitContribution({
      taskId: currentTask.value.id,
      contributions: contributions.value,
    });
    contributionMode.value = false;
  } finally {
    contributionSaving.value = false;
  }
}

// ─── 结束会议 ────────────────────────────────────────────────────────────────
async function endMeeting(): Promise<void> {
  endLoading.value = true;
  try {
    emitEnd();
    showEndConfirm.value = false;
  } finally {
    endLoading.value = false;
  }
}

// ─── AI 分显示 ───────────────────────────────────────────────────────────────
function getAiTotal(task: Task): number {
  const s = task.metadata?.aiScores;
  if (!s) return 0;
  return s.research + s.planning + s.execution;
}

function getAiScoreLabel(task: Task): string {
  const total = getAiTotal(task);
  if (total === 0) return '—';
  return `${total}/15`;
}

function statusLabel(confirmed: boolean): string {
  return confirmed ? '已确认' : '待确认';
}
</script>

<template>
  <div class="p-4 max-w-5xl mx-auto">
    <!-- 顶栏 -->
    <div class="flex items-center gap-3 mb-4">
      <button
        class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        @click="router.back()"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-heading font-bold text-foreground truncate">
          实时评审会议
          <span v-if="meeting" class="text-sm font-normal text-muted-foreground ml-2">
            {{ meeting.status === 'open' ? '进行中' : meeting.status === 'closed' ? '已结束' : '已取消' }}
          </span>
        </h1>
      </div>
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <div :class="['w-2 h-2 rounded-full', isConnected ? 'bg-green-500' : 'bg-gray-500']" />
        <Users class="w-4 h-4" />
        <span>{{ participants }}</span>
      </div>
    </div>

    <!-- 加载 / 错误 -->
    <div v-if="loading" class="glass-card p-12 text-center text-muted-foreground text-sm">
      加载中...
    </div>
    <div v-else-if="error" class="glass-card p-8 text-center text-red-400 text-sm">
      {{ error }}
    </div>

    <template v-else-if="meeting">
      <!-- 进度条 -->
      <div class="glass-card p-4 mb-4">
        <div class="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>任务进度</span>
          <span>{{ confirmedCount }} / {{ totalTaskCount }} 已确认</span>
        </div>
        <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full bg-primary rounded-full transition-all duration-500"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
      </div>

      <!-- 会议结束横幅 -->
      <div
        v-if="meetingEnded || meeting.status === 'closed'"
        class="glass-card border border-green-500/30 bg-green-500/10 p-4 mb-4 text-center"
      >
        <CheckCircle class="w-5 h-5 text-green-400 inline mr-2" />
        <span class="text-green-300 text-sm font-medium">会议已结束，结算已触发</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- 左侧：任务列表 -->
        <div class="lg:col-span-1">
          <div class="glass-card p-3">
            <h2 class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
              任务列表
            </h2>
            <div class="space-y-1">
              <button
                v-for="(task, index) in tasks"
                :key="task.id"
                class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                :class="[
                  currentTaskIndex === index
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                  focusedTaskId === task.id && currentTaskIndex !== index
                    ? 'ring-1 ring-primary/40'
                    : '',
                ]"
                @click="focusTask(index)"
              >
                <CheckCircle
                  v-if="confirmedTasks.has(task.id)"
                  class="w-3.5 h-3.5 text-green-400 flex-shrink-0"
                />
                <div
                  v-else
                  class="w-3.5 h-3.5 rounded-full border border-current flex-shrink-0 opacity-40"
                />
                <span class="truncate flex-1">{{ task.title }}</span>
                <span class="text-xs opacity-50">{{ getAiScoreLabel(task) }}</span>
              </button>
              <div v-if="tasks.length === 0" class="px-3 py-4 text-center text-xs text-muted-foreground">
                暂无待评审任务
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：当前任务详情 -->
        <div class="lg:col-span-2 space-y-4">
          <div v-if="!currentTask" class="glass-card p-8 text-center text-muted-foreground text-sm">
            请从左侧选择任务
          </div>

          <template v-else>
            <!-- 任务信息 -->
            <div class="glass-card p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="font-medium text-foreground">{{ currentTask.title }}</h3>
                  <p v-if="currentTask.description" class="text-sm text-muted-foreground mt-1">
                    {{ currentTask.description }}
                  </p>
                </div>
                <div
                  class="flex-shrink-0 text-xs px-2 py-1 rounded-full"
                  :class="isCurrentConfirmed ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-muted-foreground'"
                >
                  {{ statusLabel(isCurrentConfirmed) }}
                </div>
              </div>

              <!-- AI 三维度评分 -->
              <div v-if="currentTask.metadata?.aiScores" class="mt-3 pt-3 border-t border-white/10">
                <div class="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <BarChart3 class="w-3.5 h-3.5" />
                  AI 评审分数（总分 15）
                </div>
                <div class="grid grid-cols-3 gap-3">
                  <div class="text-center">
                    <div class="text-2xl font-bold text-foreground">
                      {{ currentTask.metadata.aiScores.research }}
                    </div>
                    <div class="text-xs text-muted-foreground mt-0.5">调查 /5</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-foreground">
                      {{ currentTask.metadata.aiScores.planning }}
                    </div>
                    <div class="text-xs text-muted-foreground mt-0.5">规划 /5</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-foreground">
                      {{ currentTask.metadata.aiScores.execution }}
                    </div>
                    <div class="text-xs text-muted-foreground mt-0.5">执行 /5</div>
                  </div>
                </div>
                <div class="mt-2 text-center">
                  <span class="text-xs text-muted-foreground">总分 </span>
                  <span class="text-lg font-bold text-primary">{{ getAiTotal(currentTask) }}</span>
                  <span class="text-xs text-muted-foreground"> /15</span>
                </div>
              </div>
              <div v-else class="mt-3 pt-3 border-t border-white/10 text-xs text-muted-foreground">
                暂无 AI 评审分数
              </div>
            </div>

            <!-- 已确认结果展示 -->
            <div v-if="isCurrentConfirmed && currentResult" class="glass-card border border-green-500/30 p-4">
              <div class="flex items-center gap-2 mb-3">
                <CheckCircle class="w-4 h-4 text-green-400" />
                <span class="text-sm font-medium text-green-300">已确认结果</span>
              </div>
              <div class="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div class="text-xl font-bold text-foreground">{{ currentResult.finalScore }}</div>
                  <div class="text-xs text-muted-foreground mt-0.5">最终分</div>
                </div>
                <div>
                  <div class="text-xl font-bold text-green-400">{{ currentResult.approvalCount }}</div>
                  <div class="text-xs text-muted-foreground mt-0.5">认可票</div>
                </div>
                <div>
                  <div class="text-xl font-bold text-amber-400">{{ currentResult.challengeCount }}</div>
                  <div class="text-xs text-muted-foreground mt-0.5">异议票</div>
                </div>
                <div>
                  <div class="text-xl font-bold text-foreground">{{ currentResult.voteCount }}</div>
                  <div class="text-xs text-muted-foreground mt-0.5">总投票</div>
                </div>
              </div>
            </div>

            <!-- 投票区（未确认时显示） -->
            <div v-if="!isCurrentConfirmed && meeting.status === 'open'" class="glass-card p-4">
              <h4 class="text-sm font-medium text-foreground mb-3">投票</h4>

              <div class="flex gap-2 mb-3">
                <button
                  class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  :class="voteMode === 'approval' ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-muted-foreground hover:bg-white/15'"
                  @click="voteMode = 'approval'"
                >
                  认可 AI 分
                </button>
                <button
                  class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  :class="voteMode === 'custom' ? 'bg-amber-500/80 text-white' : 'bg-white/10 text-muted-foreground hover:bg-white/15'"
                  @click="voteMode = 'custom'"
                >
                  自定义分数
                </button>
              </div>

              <div v-if="voteMode === 'custom'" class="mb-3">
                <input
                  v-model.number="customScore"
                  type="number"
                  min="0.01"
                  step="0.5"
                  placeholder="输入分数（无上限）"
                  class="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
                />
              </div>

              <p v-if="voteError" class="text-xs text-red-400 mb-2">{{ voteError }}</p>

              <button
                class="w-full py-2 bg-primary/90 hover:bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                :disabled="voteLoading"
                @click="castVote"
              >
                {{ voteLoading ? '提交中...' : '提交投票' }}
              </button>

              <!-- 实时统计条 -->
              <div v-if="currentStats" class="mt-3 pt-3 border-t border-white/10">
                <div class="text-xs text-muted-foreground mb-2">当前投票统计</div>
                <div class="flex items-center gap-3 text-sm">
                  <span class="text-green-400">认可 {{ currentStats.approvalCount }}</span>
                  <span class="text-amber-400">异议 {{ currentStats.challengeCount }}</span>
                  <span class="text-muted-foreground">共 {{ currentStats.voteCount }} 票</span>
                  <span v-if="currentStats.medianScore !== null" class="text-foreground ml-auto">
                    中位分 {{ currentStats.medianScore }}
                  </span>
                </div>
                <div
                  v-if="currentStats.voteCount > 0"
                  class="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden"
                >
                  <div
                    class="h-full bg-green-500 rounded-full transition-all"
                    :style="{
                      width: Math.round((currentStats.approvalCount / currentStats.voteCount) * 100) + '%'
                    }"
                  />
                </div>
              </div>
            </div>

            <!-- 多人贡献分配 -->
            <div v-if="isLead && meeting.status === 'open'" class="glass-card p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-foreground">贡献分配</h4>
                <button
                  v-if="!contributionMode"
                  class="text-xs text-primary hover:text-primary/80"
                  @click="openContributionPanel"
                >
                  编辑
                </button>
              </div>

              <div v-if="!contributionMode">
                <p class="text-xs text-muted-foreground">
                  默认全部工分归认领者。如需多人分配，点击编辑。
                </p>
              </div>

              <template v-else>
                <div class="space-y-2 mb-3">
                  <div
                    v-for="(contrib, index) in contributions"
                    :key="index"
                    class="flex gap-2 items-center"
                  >
                    <input
                      v-model="contrib.userId"
                      placeholder="用户 ID"
                      class="flex-1 px-2 py-1.5 bg-white/5 border border-white/15 rounded text-xs text-foreground focus:outline-none focus:border-primary/60"
                    />
                    <input
                      v-model.number="contrib.percentage"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="%"
                      class="w-16 px-2 py-1.5 bg-white/5 border border-white/15 rounded text-xs text-center text-foreground focus:outline-none focus:border-primary/60"
                    />
                    <span class="text-xs text-muted-foreground">%</span>
                    <button
                      class="text-muted-foreground hover:text-red-400 transition-colors"
                      @click="removeContributor(index)"
                    >
                      <X class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    class="text-xs text-primary hover:text-primary/80"
                    @click="addContributor"
                  >
                    + 添加成员
                  </button>
                  <span class="flex-1" />
                  <button
                    class="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-muted-foreground rounded text-xs transition-colors"
                    @click="contributionMode = false"
                  >
                    取消
                  </button>
                  <button
                    class="px-3 py-1.5 bg-primary/90 hover:bg-primary text-primary-foreground rounded text-xs transition-colors disabled:opacity-50"
                    :disabled="contributionSaving"
                    @click="saveContributions"
                  >
                    保存
                  </button>
                </div>
              </template>
            </div>

            <!-- 底部导航（Lead Only 操作） -->
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-2 bg-white/10 hover:bg-white/15 text-muted-foreground rounded-lg text-sm transition-colors disabled:opacity-40 flex items-center gap-1"
                :disabled="currentTaskIndex === 0"
                @click="prevTask"
              >
                <ChevronLeft class="w-4 h-4" />
                上一项
              </button>

              <span class="flex-1 text-center text-xs text-muted-foreground">
                {{ currentTaskIndex + 1 }} / {{ totalTaskCount }}
              </span>

              <button
                v-if="isLead && !isCurrentConfirmed && meeting.status === 'open'"
                class="px-3 py-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                @click="confirmAndNext"
              >
                确认并下一项
                <ChevronRight class="w-4 h-4" />
              </button>
              <button
                v-else
                class="px-3 py-2 bg-white/10 hover:bg-white/15 text-muted-foreground rounded-lg text-sm transition-colors disabled:opacity-40 flex items-center gap-1"
                :disabled="currentTaskIndex >= totalTaskCount - 1"
                @click="nextTask"
              >
                下一项
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>

            <!-- 结束会议按钮（Lead Only） -->
            <div
              v-if="isLead && meeting.status === 'open' && !meetingEnded"
              class="pt-2 border-t border-white/10"
            >
              <button
                class="w-full py-2.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg text-sm font-medium transition-colors"
                @click="showEndConfirm = true"
              >
                结束会议并触发结算
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- 结束确认模态框 -->
    <Teleport to="body">
      <div
        v-if="showEndConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="showEndConfirm = false"
      >
        <div class="glass-card w-full max-w-sm mx-4 p-6">
          <div class="flex items-center gap-3 mb-4">
            <AlertCircle class="w-5 h-5 text-amber-400 flex-shrink-0" />
            <h3 class="font-medium text-foreground">确认结束会议？</h3>
          </div>
          <p class="text-sm text-muted-foreground mb-6">
            结束后将触发工分结算，所有已确认任务的工分会正式发放，此操作不可撤销。
          </p>
          <div class="flex gap-3">
            <button
              class="flex-1 py-2 bg-white/10 hover:bg-white/15 text-muted-foreground rounded-lg text-sm transition-colors"
              @click="showEndConfirm = false"
            >
              取消
            </button>
            <button
              class="flex-1 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              :disabled="endLoading"
              @click="endMeeting"
            >
              {{ endLoading ? '处理中...' : '确认结束' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
