<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { projectApi, type Project } from '@/services/project';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const projects = ref<Project[]>([]);
const loading = ref(true);

interface ProjectPoints {
  projectId: string;
  projectName: string;
  originalTotal: number;
  activeTotal: number;
  currentRound: number;
}

const projectPoints = ref<ProjectPoints[]>([]);

onMounted(async () => {
  try {
    const res = await projectApi.list(true);
    projects.value = res.data;
    // Build placeholder points data — will be replaced with real Points API
    projectPoints.value = res.data.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      originalTotal: 0,
      activeTotal: 0,
      currentRound: p.settlementRound,
    }));
  } finally {
    loading.value = false;
  }
});

const totalOriginal = computed(() =>
  projectPoints.value.reduce((sum, p) => sum + p.originalTotal, 0),
);
const totalActive = computed(() =>
  projectPoints.value.reduce((sum, p) => sum + p.activeTotal, 0),
);
const annealingRatio = computed(() =>
  totalOriginal.value > 0 ? totalActive.value / totalOriginal.value : 1,
);

const roleLabels: Record<string, string> = {
  super_admin: '超级管理员',
  hr_admin: '人事管理员',
  project_lead: '项目负责人',
  employee: '成员',
};
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold text-foreground mb-6">个人中心</h1>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-24 bg-muted rounded-lg animate-pulse" />
    </div>

    <template v-else>
      <!-- User info card -->
      <div class="bg-card border border-border rounded-xl p-6 mb-6">
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary"
          >
            {{ authStore.user?.name?.[0] ?? '?' }}
          </div>
          <div>
            <p class="text-xl font-bold text-foreground">{{ authStore.user?.name }}</p>
            <p class="text-sm text-muted-foreground">{{ authStore.user?.email }}</p>
            <span
              class="inline-block mt-1 px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground"
            >
              {{ roleLabels[authStore.user?.role ?? ''] ?? authStore.user?.role }}
            </span>
          </div>
        </div>
      </div>

      <!-- Points overview -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-sm text-muted-foreground mb-1">总工分</p>
          <p class="text-3xl font-bold text-foreground">{{ totalOriginal }}</p>
          <p class="text-xs text-muted-foreground mt-1">历史积累</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-sm text-muted-foreground mb-1">活跃工分</p>
          <p class="text-3xl font-bold text-primary">{{ totalActive }}</p>
          <p class="text-xs text-muted-foreground mt-1">退火后有效</p>
        </div>
      </div>

      <!-- Annealing visualization -->
      <div class="bg-card border border-border rounded-xl p-5 mb-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-foreground">工分活跃度</h2>
          <span class="text-sm text-muted-foreground">
            {{ (annealingRatio * 100).toFixed(0) }}% 活跃
          </span>
        </div>
        <div class="h-3 bg-muted rounded-full overflow-hidden">
          <div
            class="h-full bg-primary rounded-full transition-all duration-500"
            :style="{ width: `${annealingRatio * 100}%` }"
          />
        </div>
        <p class="text-xs text-muted-foreground mt-2">
          工分每经过3次结算后活跃度减半，防止贡献固化
        </p>
      </div>

      <!-- Per project breakdown -->
      <div class="space-y-3">
        <h2 class="font-semibold text-foreground">项目工分明细</h2>
        <div
          v-if="projectPoints.length === 0"
          class="text-sm text-muted-foreground py-4 text-center"
        >
          还未加入任何项目
        </div>
        <div
          v-for="pp in projectPoints"
          :key="pp.projectId"
          class="bg-card border border-border rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-2">
            <p class="font-medium text-sm text-foreground">{{ pp.projectName }}</p>
            <span class="text-xs text-muted-foreground">第 {{ pp.currentRound }} 结算轮</span>
          </div>
          <div class="grid grid-cols-2 gap-3 text-center">
            <div class="bg-muted/50 rounded-md py-2">
              <p class="text-lg font-bold text-foreground">{{ pp.originalTotal }}</p>
              <p class="text-xs text-muted-foreground">历史工分</p>
            </div>
            <div class="bg-primary/5 rounded-md py-2">
              <p class="text-lg font-bold text-primary">{{ pp.activeTotal }}</p>
              <p class="text-xs text-muted-foreground">活跃工分</p>
            </div>
          </div>
          <div v-if="pp.originalTotal > 0" class="mt-2">
            <div class="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full bg-primary rounded-full"
                :style="{ width: `${(pp.activeTotal / pp.originalTotal) * 100}%` }"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
