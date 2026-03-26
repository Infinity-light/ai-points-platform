<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { projectApi, type Project } from '@/services/project';
import { taskApi, type Task } from '@/services/task';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/axios';
import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();
const authStore = useAuthStore();

// ── Loading states ────────────────────────────────────────────────────────────
const loadingSummary = ref(true);
const loadingProjects = ref(true);
const loadingTasks = ref(true);

// ── Section 1: Points summary ─────────────────────────────────────────────────
interface PointsSummary {
  totalPoints: number;
  activePoints: number;
  monthlyPoints: number;
}
const summary = ref<PointsSummary>({ totalPoints: 0, activePoints: 0, monthlyPoints: 0 });

// ── Section 2: Projects ───────────────────────────────────────────────────────
interface ProjectWithProgress extends Project {
  taskTotal: number;
  taskDone: number;
}
const projects = ref<ProjectWithProgress[]>([]);

// ── Section 3: My pending tasks ───────────────────────────────────────────────
interface PendingTask extends Task {
  projectName: string;
}
const pendingTasks = ref<PendingTask[]>([]);

// ── Section 4: Activity feed (mock) ───────────────────────────────────────────
interface ActivityItem {
  id: string;
  text: string;
  time: string;
  type: 'points' | 'task' | 'project';
}
const activities = ref<ActivityItem[]>([]);

// ── Helpers ───────────────────────────────────────────────────────────────────
const roleLabels: Record<string, string> = {
  super_admin: '超级管理员',
  hr_admin: '人事管理',
  project_lead: '项目负责人',
  employee: '成员',
};

function progressPercent(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

const taskStatusLabels: Record<string, string> = {
  open: '待认领',
  claimed: '进行中',
  submitted: '已提交',
  ai_reviewing: 'AI 审核中',
  pending_vote: '待投票',
  settled: '已结算',
  cancelled: '已取消',
};

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchSummary() {
  try {
    const res = await api.get<PointsSummary>('/points/my-summary');
    summary.value = res.data;
  } catch {
    // Endpoint may not exist yet — keep zeros
    summary.value = { totalPoints: 0, activePoints: 0, monthlyPoints: 0 };
  } finally {
    loadingSummary.value = false;
  }
}

async function fetchProjects() {
  try {
    const res = await projectApi.list(true);
    const rawProjects = res.data.filter((p) => p.status === 'active');

    // Fetch tasks for each project to compute progress
    const enriched = await Promise.all(
      rawProjects.map(async (p): Promise<ProjectWithProgress> => {
        try {
          const tRes = await taskApi.list(p.id);
          const tasks = tRes.data;
          const done = tasks.filter((t) =>
            ['settled', 'ai_reviewing', 'pending_vote'].includes(t.status),
          ).length;
          return { ...p, taskTotal: tasks.length, taskDone: done };
        } catch {
          return { ...p, taskTotal: 0, taskDone: 0 };
        }
      }),
    );
    projects.value = enriched;

    // Derive pending tasks from what we already fetched
    const myId = authStore.user?.id;
    const pending: PendingTask[] = [];
    for (const proj of rawProjects) {
      try {
        const tRes = await taskApi.list(proj.id);
        const mine = tRes.data.filter(
          (t) => t.assigneeId === myId && (t.status === 'claimed' || t.status === 'submitted'),
        );
        mine.forEach((t) => pending.push({ ...t, projectName: proj.name }));
      } catch {
        // ignore
      }
    }
    pendingTasks.value = pending;
  } catch {
    projects.value = [];
    pendingTasks.value = [];
  } finally {
    loadingProjects.value = false;
    loadingTasks.value = false;
  }
}

function buildMockActivities() {
  const userName = authStore.user?.name ?? '用户';
  activities.value = [
    {
      id: '1',
      text: `欢迎使用 AI 工分平台，${userName}！`,
      time: '刚刚',
      type: 'project',
    },
    {
      id: '2',
      text: '完成任务后将在此处显示最新动态',
      time: '—',
      type: 'task',
    },
  ];
}

onMounted(async () => {
  buildMockActivities();
  await Promise.all([fetchSummary(), fetchProjects()]);
});
</script>

<template>
  <div class="p-6 space-y-8 max-w-5xl mx-auto">
    <!-- Greeting -->
    <div>
      <h1 class="text-2xl font-bold text-foreground">
        你好，{{ authStore.user?.name ?? '用户' }}
      </h1>
      <p class="text-muted-foreground mt-1 text-sm">
        {{ roleLabels[authStore.user?.role ?? ''] ?? '成员' }} · 工作台概览
      </p>
    </div>

    <!-- ── Section 1: Points summary ──────────────────────────────────────── -->
    <section>
      <h2 class="text-base font-semibold text-foreground mb-3">个人工分摘要</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Total points -->
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-xs text-muted-foreground mb-1">总工分</p>
          <div v-if="loadingSummary" class="h-7 w-16 bg-muted rounded animate-pulse" />
          <p v-else class="text-2xl font-bold text-foreground">
            {{ summary.totalPoints.toLocaleString() }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">历史累计获得</p>
        </div>

        <!-- Active points -->
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-xs text-muted-foreground mb-1">活跃工分</p>
          <div v-if="loadingSummary" class="h-7 w-16 bg-muted rounded animate-pulse" />
          <p v-else class="text-2xl font-bold text-primary">
            {{ summary.activePoints.toLocaleString() }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">退火后当前有效</p>
        </div>

        <!-- Monthly points -->
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-xs text-muted-foreground mb-1">本月新增</p>
          <div v-if="loadingSummary" class="h-7 w-16 bg-muted rounded animate-pulse" />
          <p v-else class="text-2xl font-bold text-foreground">
            {{ summary.monthlyPoints.toLocaleString() }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">{{ new Date().toLocaleDateString('zh-CN', { month: 'long' }) }}</p>
        </div>
      </div>
    </section>

    <!-- ── Section 2: Project progress ───────────────────────────────────── -->
    <section>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold text-foreground">项目进度</h2>
        <BaseButton size="sm" variant="ghost" @click="router.push('/projects')">查看全部</BaseButton>
      </div>

      <div v-if="loadingProjects" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-20 bg-muted rounded-xl animate-pulse" />
      </div>

      <div
        v-else-if="projects.length === 0"
        class="bg-card border border-border rounded-xl p-8 text-center"
      >
        <p class="text-sm text-muted-foreground">还没有活跃项目</p>
        <BaseButton size="sm" class="mt-3" @click="router.push('/projects/create')">
          创建项目
        </BaseButton>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="p in projects.slice(0, 5)"
          :key="p.id"
          class="bg-card border border-border rounded-xl p-4 hover:border-primary/40 cursor-pointer transition-colors"
          @click="router.push(`/projects/${p.id}`)"
        >
          <div class="flex items-center justify-between mb-2">
            <p class="font-medium text-sm text-foreground">{{ p.name }}</p>
            <span class="text-xs text-muted-foreground">
              第 {{ p.settlementRound }} 轮 &middot;
              {{ p.taskDone }}/{{ p.taskTotal }} 任务完成
            </span>
          </div>

          <!-- Progress bar -->
          <div class="w-full bg-muted rounded-full h-1.5">
            <div
              class="bg-primary rounded-full h-1.5 transition-all duration-500"
              :style="{ width: `${progressPercent(p.taskDone, p.taskTotal)}%` }"
            />
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            {{ progressPercent(p.taskDone, p.taskTotal) }}% 完成
          </p>
        </div>
      </div>
    </section>

    <!-- ── Section 3 & 4: side-by-side on large screens ─────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- Section 3: Pending tasks -->
      <section>
        <h2 class="text-base font-semibold text-foreground mb-3">待处理任务</h2>

        <div v-if="loadingTasks" class="space-y-2">
          <div v-for="i in 3" :key="i" class="h-16 bg-muted rounded-lg animate-pulse" />
        </div>

        <div
          v-else-if="pendingTasks.length === 0"
          class="bg-card border border-border rounded-xl p-6 text-center"
        >
          <p class="text-sm text-muted-foreground">暂无待处理任务</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="t in pendingTasks.slice(0, 8)"
            :key="t.id"
            class="bg-card border border-border rounded-lg p-3 hover:border-primary/40 cursor-pointer transition-colors"
            @click="router.push(`/projects/${t.projectId}`)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate">{{ t.title }}</p>
                <p class="text-xs text-muted-foreground mt-0.5 truncate">{{ t.projectName }}</p>
              </div>
              <span
                class="shrink-0 text-xs px-2 py-0.5 rounded-full border"
                :class="{
                  'border-blue-400/50 text-blue-600 bg-blue-50': t.status === 'claimed',
                  'border-yellow-400/50 text-yellow-700 bg-yellow-50': t.status === 'submitted',
                }"
              >
                {{ taskStatusLabels[t.status] ?? t.status }}
              </span>
            </div>
            <p v-if="t.estimatedPoints" class="text-xs text-muted-foreground mt-1">
              预计 {{ t.estimatedPoints }} 工分
            </p>
          </div>
        </div>
      </section>

      <!-- Section 4: Activity feed -->
      <section>
        <h2 class="text-base font-semibold text-foreground mb-3">全局动态</h2>

        <div class="bg-card border border-border rounded-xl p-4 space-y-3">
          <div
            v-for="item in activities"
            :key="item.id"
            class="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
          >
            <div
              class="mt-0.5 w-2 h-2 rounded-full shrink-0"
              :class="{
                'bg-primary': item.type === 'points',
                'bg-blue-500': item.type === 'task',
                'bg-green-500': item.type === 'project',
              }"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-foreground">{{ item.text }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">{{ item.time }}</p>
            </div>
          </div>

          <p class="text-xs text-muted-foreground text-center pt-1">
            更多动态将在平台活跃后实时展示
          </p>
        </div>
      </section>

    </div>
  </div>
</template>
