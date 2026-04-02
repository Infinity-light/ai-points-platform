<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { superAdminApi, type OpsStats } from '@/services/super-admin';
import { adminApi, type TenantStats } from '@/services/admin';

const ops = ref<OpsStats | null>(null);
const opsLoading = ref(false);
const opsError = ref('');

const tenantStats = ref<TenantStats | null>(null);
const tenantStatsLoading = ref(false);
const tenantStatsError = ref('');

async function loadOps() {
  opsLoading.value = true;
  opsError.value = '';
  try {
    ops.value = await superAdminApi.getOps();
  } catch (e: unknown) {
    opsError.value = (e as Error).message ?? '加载失败';
  } finally {
    opsLoading.value = false;
  }
}

async function loadTenantStats() {
  tenantStatsLoading.value = true;
  tenantStatsError.value = '';
  try {
    tenantStats.value = await adminApi.getStats();
  } catch {
    tenantStatsError.value = '加载统计数据失败';
  } finally {
    tenantStatsLoading.value = false;
  }
}

async function refresh() {
  await Promise.all([loadOps(), loadTenantStats()]);
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-heading font-semibold text-foreground">运营数据</h2>
      <button
        class="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200 cursor-pointer"
        @click="refresh"
      >
        刷新
      </button>
    </div>

    <!-- 全局运营数据 -->
    <div v-if="opsLoading" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div v-for="i in 4" :key="i" class="h-24 bg-secondary rounded-xl animate-pulse" />
    </div>

    <p v-else-if="opsError" class="text-sm text-destructive mb-4">{{ opsError }}</p>

    <div v-else-if="ops" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="glass-card p-5">
        <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">总租户数</p>
        <p class="text-3xl font-mono font-bold text-foreground">{{ ops.totalTenants }}</p>
      </div>
      <div class="glass-card p-5">
        <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">总用户数</p>
        <p class="text-3xl font-mono font-bold text-foreground">{{ ops.totalUsers }}</p>
      </div>
      <div class="glass-card p-5">
        <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">总任务数</p>
        <p class="text-3xl font-mono font-bold text-foreground">{{ ops.totalTasks }}</p>
      </div>
      <div class="glass-card p-5">
        <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">总提交数</p>
        <p class="text-3xl font-mono font-bold text-foreground">{{ ops.totalSubmissions }}</p>
      </div>
    </div>

    <!-- 租户内统计 -->
    <div v-if="tenantStatsLoading" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="i in 3" :key="i" class="h-28 bg-secondary rounded-lg animate-pulse" />
    </div>

    <p v-else-if="tenantStatsError" class="text-sm text-destructive mb-4">{{ tenantStatsError }}</p>

    <div v-else-if="tenantStats">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="glass-card p-5">
          <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider">租户用户数</p>
          <p class="text-3xl font-mono font-bold text-foreground mt-1">{{ tenantStats.totalUsers }}</p>
        </div>
        <div class="glass-card p-5">
          <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider">累计发放工分</p>
          <p class="text-3xl font-mono font-bold text-foreground mt-1">{{ tenantStats.totalPointsAwarded }}</p>
        </div>
        <div class="glass-card p-5">
          <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider">活跃项目数</p>
          <p class="text-3xl font-mono font-bold text-foreground mt-1">—</p>
        </div>
      </div>

      <div v-if="tenantStats.usersByRole && Object.keys(tenantStats.usersByRole).length > 0" class="glass-card p-5">
        <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">角色分布</h3>
        <div class="space-y-3">
          <div
            v-for="(count, role) in tenantStats.usersByRole"
            :key="role"
            class="flex items-center justify-between"
          >
            <span class="text-sm text-muted-foreground">{{ String(role) }}</span>
            <div class="flex items-center gap-3">
              <div class="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full"
                  :style="{
                    width:
                      tenantStats && tenantStats.totalUsers > 0
                        ? `${(count / tenantStats.totalUsers) * 100}%`
                        : '0%',
                  }"
                />
              </div>
              <span class="text-sm font-mono font-medium text-foreground w-8 text-right">{{ count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
