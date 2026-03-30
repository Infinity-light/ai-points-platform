<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { superAdminApi, type Tenant, type GlobalConfig, type OpsStats } from '@/services/super-admin';

// ---- Tab state ----
type Tab = 'tenants' | 'config' | 'ops';
const activeTab = ref<Tab>('tenants');

// ---- Tenants tab ----
const tenants = ref<Tenant[]>([]);
const tenantsLoading = ref(false);
const tenantsError = ref('');

// New tenant form
const showCreateForm = ref(false);
const newTenant = ref({ name: '', slug: '' });
const createLoading = ref(false);
const createError = ref('');

async function loadTenants() {
  tenantsLoading.value = true;
  tenantsError.value = '';
  try {
    tenants.value = await superAdminApi.listTenants();
  } catch (e: unknown) {
    tenantsError.value = (e as Error).message ?? '加载失败';
  } finally {
    tenantsLoading.value = false;
  }
}

async function createTenant() {
  createLoading.value = true;
  createError.value = '';
  try {
    const created = await superAdminApi.createTenant(newTenant.value);
    tenants.value.unshift(created);
    showCreateForm.value = false;
    newTenant.value = { name: '', slug: '' };
  } catch (e: unknown) {
    createError.value = (e as Error).message ?? '创建失败';
  } finally {
    createLoading.value = false;
  }
}

async function toggleActive(tenant: Tenant) {
  try {
    const updated = await superAdminApi.updateTenant(tenant.id, { isActive: !tenant.isActive });
    const idx = tenants.value.findIndex((t) => t.id === tenant.id);
    if (idx !== -1) tenants.value[idx] = updated;
  } catch (e: unknown) {
    alert('操作失败: ' + ((e as Error).message ?? '未知错误'));
  }
}

async function deleteTenant(tenant: Tenant) {
  if (!confirm(`确认删除租户 "${tenant.name}"？此操作不可撤销。`)) return;
  try {
    await superAdminApi.deleteTenant(tenant.id);
    tenants.value = tenants.value.filter((t) => t.id !== tenant.id);
  } catch (e: unknown) {
    alert('删除失败: ' + ((e as Error).message ?? '未知错误'));
  }
}

// ---- Config tab ----
const config = ref<GlobalConfig>({ llmModel: '', llmBaseUrl: '', maxFileSizeMb: 10 });
const configLoading = ref(false);
const configSaving = ref(false);
const configError = ref('');
const configSuccess = ref(false);

async function loadConfig() {
  configLoading.value = true;
  configError.value = '';
  try {
    config.value = await superAdminApi.getConfig();
  } catch (e: unknown) {
    configError.value = (e as Error).message ?? '加载失败';
  } finally {
    configLoading.value = false;
  }
}

async function saveConfig() {
  configSaving.value = true;
  configError.value = '';
  configSuccess.value = false;
  try {
    config.value = await superAdminApi.updateConfig(config.value);
    configSuccess.value = true;
    setTimeout(() => { configSuccess.value = false; }, 2000);
  } catch (e: unknown) {
    configError.value = (e as Error).message ?? '保存失败';
  } finally {
    configSaving.value = false;
  }
}

// ---- Ops tab ----
const ops = ref<OpsStats | null>(null);
const opsLoading = ref(false);
const opsError = ref('');

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

// ---- Tab switch ----
function switchTab(tab: Tab) {
  activeTab.value = tab;
  if (tab === 'tenants' && tenants.value.length === 0) loadTenants();
  if (tab === 'config' && !config.value.llmModel) loadConfig();
  if (tab === 'ops' && !ops.value) loadOps();
}

onMounted(() => {
  loadTenants();
});

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h1 class="text-2xl font-heading font-bold text-foreground mb-6">超级管理员面板</h1>

    <!-- Tab navigation -->
    <div class="flex border-b border-border mb-6">
      <button
        v-for="tab in ([
          { key: 'tenants', label: '租户管理' },
          { key: 'config', label: '全局配置' },
          { key: 'ops', label: '运营数据' },
        ] as const)"
        :key="tab.key"
        class="px-5 py-2 text-sm font-medium border-b-2 transition-colors duration-200 cursor-pointer"
        :class="activeTab === tab.key
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- =================== TENANTS TAB =================== -->
    <div v-if="activeTab === 'tenants'">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-heading font-semibold text-foreground">所有租户</h2>
        <button
          class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors duration-200 cursor-pointer"
          @click="showCreateForm = !showCreateForm"
        >
          新建租户
        </button>
      </div>

      <!-- Create form -->
      <div
        v-if="showCreateForm"
        class="glass-card p-5 mb-4"
      >
        <h3 class="font-medium text-foreground mb-3">新建租户</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm text-muted-foreground mb-1">租户名称</label>
            <input
              v-model="newTenant.name"
              type="text"
              placeholder="例：我的公司"
              class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200"
            />
          </div>
          <div>
            <label class="block text-sm text-muted-foreground mb-1">Slug（URL 标识）</label>
            <input
              v-model="newTenant.slug"
              type="text"
              placeholder="例：my-company"
              class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200"
            />
            <p class="text-xs text-muted-foreground mt-1">只能包含小写字母、数字和连字符</p>
          </div>
          <p v-if="createError" class="text-sm text-destructive">{{ createError }}</p>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200 cursor-pointer"
              :disabled="createLoading || !newTenant.name || !newTenant.slug"
              @click="createTenant"
            >
              {{ createLoading ? '创建中...' : '确认创建' }}
            </button>
            <button
              class="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200 cursor-pointer"
              @click="showCreateForm = false; createError = ''"
            >
              取消
            </button>
          </div>
        </div>
      </div>

      <!-- Error -->
      <p v-if="tenantsError" class="text-sm text-destructive mb-4">{{ tenantsError }}</p>

      <!-- Loading -->
      <div v-if="tenantsLoading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-14 bg-secondary rounded-lg animate-pulse" />
      </div>

      <!-- Table -->
      <div v-else-if="tenants.length > 0" class="glass-card overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-secondary/30">
              <th class="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">名称</th>
              <th class="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Slug</th>
              <th class="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">状态</th>
              <th class="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">创建时间</th>
              <th class="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tenant in tenants"
              :key="tenant.id"
              class="border-b border-border last:border-0 hover:bg-white/5 transition-colors duration-200"
            >
              <td class="px-4 py-3 font-medium text-foreground">{{ tenant.name }}</td>
              <td class="px-4 py-3 text-muted-foreground font-mono text-xs">{{ tenant.slug }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="tenant.isActive
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-secondary text-muted-foreground'"
                >
                  {{ tenant.isActive ? '启用' : '停用' }}
                </span>
              </td>
              <td class="px-4 py-3 font-mono text-muted-foreground text-xs">{{ formatDate(tenant.createdAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-2">
                  <button
                    class="text-xs px-2 py-1 rounded border border-border hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                    @click="toggleActive(tenant)"
                  >
                    {{ tenant.isActive ? '停用' : '启用' }}
                  </button>
                  <button
                    class="text-xs px-2 py-1 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors duration-200 cursor-pointer"
                    @click="deleteTenant(tenant)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="text-sm text-muted-foreground text-center py-8">暂无租户</p>
    </div>

    <!-- =================== CONFIG TAB =================== -->
    <div v-else-if="activeTab === 'config'">
      <h2 class="font-heading font-semibold text-foreground mb-4">全局配置</h2>

      <div v-if="configLoading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-12 bg-secondary rounded-lg animate-pulse" />
      </div>

      <div v-else class="glass-card p-6 max-w-lg space-y-5">
        <div>
          <label class="block text-sm font-medium text-foreground mb-1">LLM 模型名称</label>
          <input
            v-model="config.llmModel"
            type="text"
            placeholder="claude-sonnet-4-6"
            class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-foreground mb-1">LLM API Base URL</label>
          <input
            v-model="config.llmBaseUrl"
            type="text"
            placeholder="（可选，留空使用默认）"
            class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-foreground mb-1">最大文件大小 (MB)</label>
          <input
            v-model.number="config.maxFileSizeMb"
            type="number"
            min="1"
            max="500"
            class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200"
          />
        </div>

        <p v-if="configError" class="text-sm text-destructive">{{ configError }}</p>
        <p v-if="configSuccess" class="text-sm text-green-400">保存成功</p>

        <button
          class="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200 cursor-pointer"
          :disabled="configSaving"
          @click="saveConfig"
        >
          {{ configSaving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>

    <!-- =================== OPS TAB =================== -->
    <div v-else-if="activeTab === 'ops'">
      <h2 class="font-heading font-semibold text-foreground mb-4">运营数据</h2>

      <div v-if="opsLoading" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="h-24 bg-secondary rounded-xl animate-pulse" />
      </div>

      <p v-else-if="opsError" class="text-sm text-destructive">{{ opsError }}</p>

      <div v-else-if="ops" class="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      <button
        class="mt-4 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200 cursor-pointer"
        @click="loadOps"
      >
        刷新
      </button>
    </div>
  </div>
</template>
