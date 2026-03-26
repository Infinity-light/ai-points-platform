<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type AdminUser, type InviteCode, type TenantStats } from '@/services/admin';

const activeTab = ref<'users' | 'invites' | 'stats'>('users');

// Users tab
const users = ref<AdminUser[]>([]);
const usersLoading = ref(false);
const usersError = ref('');
const roleUpdateLoading = ref<Record<string, boolean>>({});

// Invites tab
const invites = ref<InviteCode[]>([]);
const invitesLoading = ref(false);
const invitesError = ref('');
const toggleLoading = ref<Record<string, boolean>>({});

// Stats tab
const stats = ref<TenantStats | null>(null);
const statsLoading = ref(false);
const statsError = ref('');

const availableRoles = [
  { value: 'employee', label: '普通员工' },
  { value: 'project_lead', label: '项目负责人' },
  { value: 'hr_admin', label: 'HR管理员' },
];

async function loadUsers() {
  usersLoading.value = true;
  usersError.value = '';
  try {
    users.value = await adminApi.listUsers();
  } catch {
    usersError.value = '加载用户失败，请刷新重试';
  } finally {
    usersLoading.value = false;
  }
}

async function updateRole(userId: string, role: string) {
  roleUpdateLoading.value[userId] = true;
  try {
    const updated = await adminApi.updateUserRole(userId, role);
    const idx = users.value.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      users.value[idx] = updated;
    }
  } catch {
    usersError.value = '更新角色失败，请重试';
  } finally {
    roleUpdateLoading.value[userId] = false;
  }
}

async function loadInvites() {
  invitesLoading.value = true;
  invitesError.value = '';
  try {
    invites.value = await adminApi.listInvites();
  } catch {
    invitesError.value = '加载邀请码失败，请刷新重试';
  } finally {
    invitesLoading.value = false;
  }
}

async function toggleInvite(id: string, isActive: boolean) {
  toggleLoading.value[id] = true;
  try {
    const updated = await adminApi.toggleInvite(id, isActive);
    const idx = invites.value.findIndex((i) => i.id === id);
    if (idx !== -1) {
      invites.value[idx] = updated;
    }
  } catch {
    invitesError.value = '操作失败，请重试';
  } finally {
    toggleLoading.value[id] = false;
  }
}

async function loadStats() {
  statsLoading.value = true;
  statsError.value = '';
  try {
    stats.value = await adminApi.getStats();
  } catch {
    statsError.value = '加载统计数据失败，请刷新重试';
  } finally {
    statsLoading.value = false;
  }
}

function switchTab(tab: 'users' | 'invites' | 'stats') {
  activeTab.value = tab;
  if (tab === 'users' && users.value.length === 0) loadUsers();
  if (tab === 'invites' && invites.value.length === 0) loadInvites();
  if (tab === 'stats' && !stats.value) loadStats();
}

function formatDate(iso: string | null) {
  if (!iso) return '永不过期';
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function roleLabel(role: string) {
  return availableRoles.find((r) => r.value === role)?.label ?? role;
}

onMounted(() => {
  loadUsers();
});
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-foreground">管理后台</h1>
      <p class="text-sm text-muted-foreground mt-0.5">HR管理员控制台</p>
    </div>

    <!-- Tabs -->
    <div class="border-b border-border mb-6">
      <nav class="flex gap-6">
        <button
          v-for="tab in [
            { key: 'users', label: '用户管理' },
            { key: 'invites', label: '邀请码管理' },
            { key: 'stats', label: '统计概览' },
          ]"
          :key="tab.key"
          class="pb-3 text-sm font-medium transition-colors border-b-2 -mb-px"
          :class="
            activeTab === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="switchTab(tab.key as 'users' | 'invites' | 'stats')"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Users Tab -->
    <div v-if="activeTab === 'users'">
      <div v-if="usersLoading" class="space-y-2">
        <div v-for="i in 5" :key="i" class="h-12 bg-muted rounded animate-pulse" />
      </div>
      <div
        v-else-if="usersError"
        class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
      >
        {{ usersError }}
      </div>
      <div v-else-if="users.length === 0" class="text-center py-12 text-muted-foreground text-sm">
        暂无用户
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left text-muted-foreground">
              <th class="pb-3 font-medium pr-4">姓名</th>
              <th class="pb-3 font-medium pr-4">邮箱</th>
              <th class="pb-3 font-medium pr-4">角色</th>
              <th class="pb-3 font-medium pr-4">邮箱验证</th>
              <th class="pb-3 font-medium">注册时间</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="user in users" :key="user.id" class="hover:bg-accent/30 transition-colors">
              <td class="py-3 pr-4 font-medium text-foreground">{{ user.name }}</td>
              <td class="py-3 pr-4 text-muted-foreground">{{ user.email }}</td>
              <td class="py-3 pr-4">
                <select
                  :value="user.role"
                  :disabled="roleUpdateLoading[user.id]"
                  class="text-sm border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  @change="updateRole(user.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="r in availableRoles" :key="r.value" :value="r.value">
                    {{ r.label }}
                  </option>
                </select>
              </td>
              <td class="py-3 pr-4">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="
                    user.isEmailVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  "
                >
                  {{ user.isEmailVerified ? '已验证' : '未验证' }}
                </span>
              </td>
              <td class="py-3 text-muted-foreground">{{ formatDate(user.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Invites Tab -->
    <div v-else-if="activeTab === 'invites'">
      <div v-if="invitesLoading" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-12 bg-muted rounded animate-pulse" />
      </div>
      <div
        v-else-if="invitesError"
        class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
      >
        {{ invitesError }}
      </div>
      <div v-else-if="invites.length === 0" class="text-center py-12 text-muted-foreground text-sm">
        暂无邀请码
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left text-muted-foreground">
              <th class="pb-3 font-medium pr-4">邀请码</th>
              <th class="pb-3 font-medium pr-4">备注</th>
              <th class="pb-3 font-medium pr-4">使用次数</th>
              <th class="pb-3 font-medium pr-4">状态</th>
              <th class="pb-3 font-medium pr-4">过期时间</th>
              <th class="pb-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="invite in invites" :key="invite.id" class="hover:bg-accent/30 transition-colors">
              <td class="py-3 pr-4 font-mono font-medium text-foreground">{{ invite.code }}</td>
              <td class="py-3 pr-4 text-muted-foreground">{{ invite.note ?? '—' }}</td>
              <td class="py-3 pr-4 text-muted-foreground">
                {{ invite.usedCount }} / {{ invite.maxUses }}
              </td>
              <td class="py-3 pr-4">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="
                    invite.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  "
                >
                  {{ invite.isActive ? '启用' : '停用' }}
                </span>
              </td>
              <td class="py-3 pr-4 text-muted-foreground">{{ formatDate(invite.expiresAt) }}</td>
              <td class="py-3">
                <button
                  :disabled="toggleLoading[invite.id]"
                  class="text-xs px-3 py-1 rounded border border-border hover:bg-accent transition-colors disabled:opacity-50"
                  @click="toggleInvite(invite.id, !invite.isActive)"
                >
                  {{ invite.isActive ? '停用' : '启用' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Stats Tab -->
    <div v-else-if="activeTab === 'stats'">
      <div v-if="statsLoading" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="h-28 bg-muted rounded-lg animate-pulse" />
      </div>
      <div
        v-else-if="statsError"
        class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
      >
        {{ statsError }}
      </div>
      <div v-else-if="stats">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <!-- Total users card -->
          <div class="bg-card border border-border rounded-lg p-5">
            <p class="text-sm text-muted-foreground">总用户数</p>
            <p class="text-3xl font-bold text-foreground mt-1">{{ stats.totalUsers }}</p>
          </div>
          <!-- Total points card -->
          <div class="bg-card border border-border rounded-lg p-5">
            <p class="text-sm text-muted-foreground">累计发放工分</p>
            <p class="text-3xl font-bold text-foreground mt-1">{{ stats.totalPointsAwarded }}</p>
          </div>
          <!-- Active invite codes card -->
          <div class="bg-card border border-border rounded-lg p-5">
            <p class="text-sm text-muted-foreground">有效邀请码</p>
            <p class="text-3xl font-bold text-foreground mt-1">{{ stats.activeInviteCodes }}</p>
          </div>
        </div>

        <!-- Role breakdown -->
        <div class="bg-card border border-border rounded-lg p-5">
          <h3 class="text-sm font-semibold text-foreground mb-4">角色分布</h3>
          <div class="space-y-3">
            <div
              v-for="(count, role) in stats.usersByRole"
              :key="role"
              class="flex items-center justify-between"
            >
              <span class="text-sm text-muted-foreground">{{ roleLabel(String(role)) }}</span>
              <div class="flex items-center gap-3">
                <div class="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    class="h-full bg-primary rounded-full"
                    :style="{
                      width: stats.totalUsers > 0 ? `${(count / stats.totalUsers) * 100}%` : '0%',
                    }"
                  />
                </div>
                <span class="text-sm font-medium text-foreground w-8 text-right">{{ count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
