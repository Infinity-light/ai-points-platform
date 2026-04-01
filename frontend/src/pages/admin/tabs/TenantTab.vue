<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { superAdminApi, type Tenant } from '@/services/super-admin';

const tenants = ref<Tenant[]>([]);
const loading = ref(false);
const error = ref('');

const showCreateForm = ref(false);
const newTenant = ref({ name: '', slug: '' });
const createLoading = ref(false);
const createError = ref('');

async function loadTenants() {
  loading.value = true;
  error.value = '';
  try {
    tenants.value = await superAdminApi.listTenants();
  } catch (e: unknown) {
    error.value = (e as Error).message ?? '加载失败';
  } finally {
    loading.value = false;
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
    error.value = '操作失败: ' + ((e as Error).message ?? '未知错误');
  }
}

async function deleteTenant(tenant: Tenant) {
  if (!confirm(`确认删除租户 "${tenant.name}"？此操作不可撤销。`)) return;
  try {
    await superAdminApi.deleteTenant(tenant.id);
    tenants.value = tenants.value.filter((t) => t.id !== tenant.id);
  } catch (e: unknown) {
    error.value = '删除失败: ' + ((e as Error).message ?? '未知错误');
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

onMounted(() => {
  void loadTenants();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-heading font-semibold text-foreground">所有租户</h2>
      <button
        class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors duration-200 cursor-pointer"
        @click="showCreateForm = !showCreateForm"
      >
        新建租户
      </button>
    </div>

    <!-- 新建表单 -->
    <div v-if="showCreateForm" class="glass-card p-5 mb-4">
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

    <p v-if="error" class="text-sm text-destructive mb-4">{{ error }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-14 bg-secondary rounded-lg animate-pulse" />
    </div>

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
                :class="
                  tenant.isActive
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-secondary text-muted-foreground'
                "
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
</template>
