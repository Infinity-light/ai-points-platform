<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type AdminUser } from '@/services/admin';
import { rbacApi, type RoleDto, type UserProjectInfo } from '@/services/rbac';
import { ChevronDown } from 'lucide-vue-next';

const users = ref<AdminUser[]>([]);
const usersLoading = ref(false);
const usersError = ref('');
const roleUpdateLoading = ref<Record<string, boolean>>({});

const tenantRoles = ref<RoleDto[]>([]);
const rolesLoading = ref(false);

const expandedUserId = ref<string | null>(null);
const userProjects = ref<Record<string, UserProjectInfo[]>>({});
const projectsLoading = ref<Record<string, boolean>>({});
const projectRoles = ref<RoleDto[]>([]);
const projectRoleUpdateLoading = ref<Record<string, boolean>>({});

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

async function loadRoles() {
  rolesLoading.value = true;
  try {
    const [tenant, project] = await Promise.all([
      rbacApi.listRoles('tenant'),
      rbacApi.listRoles('project'),
    ]);
    tenantRoles.value = tenant;
    projectRoles.value = project;
  } catch {
    // 静默失败，使用空列表
  } finally {
    rolesLoading.value = false;
  }
}

async function updateTenantRole(userId: string, roleId: string) {
  if (!roleId) return;
  roleUpdateLoading.value[userId] = true;
  usersError.value = '';
  try {
    await rbacApi.assignTenantRole(userId, roleId);
    // Update local state
    const user = users.value.find((u) => u.id === userId);
    if (user) {
      user.tenantRoleId = roleId;
      user.tenantRoleName = tenantRoles.value.find((r) => r.id === roleId)?.name ?? null;
    }
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    usersError.value = msg ? `更新角色失败：${Array.isArray(msg) ? msg.join(', ') : msg}` : '更新角色失败，请重试';
  } finally {
    roleUpdateLoading.value[userId] = false;
  }
}

async function toggleUserProjects(userId: string) {
  if (expandedUserId.value === userId) {
    expandedUserId.value = null;
    return;
  }
  expandedUserId.value = userId;
  if (userProjects.value[userId]) return;

  projectsLoading.value[userId] = true;
  try {
    const res = await adminApi.getUserProjects(userId);
    userProjects.value[userId] = res;
  } catch {
    userProjects.value[userId] = [];
  } finally {
    projectsLoading.value[userId] = false;
  }
}

async function updateProjectRole(userId: string, projectId: string, roleId: string) {
  const key = `${userId}:${projectId}`;
  projectRoleUpdateLoading.value[key] = true;
  try {
    await rbacApi.assignProjectRole(userId, projectId, roleId);
    if (userProjects.value[userId]) {
      const member = userProjects.value[userId].find((m) => m.projectId === projectId);
      if (member) {
        member.projectRoleId = roleId;
        const role = projectRoles.value.find((r) => r.id === roleId);
        member.projectRoleName = role?.name ?? null;
      }
    }
  } catch {
    usersError.value = '更新项目角色失败，请重试';
  } finally {
    projectRoleUpdateLoading.value[key] = false;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

onMounted(() => {
  void Promise.all([loadUsers(), loadRoles()]);
});
</script>

<template>
  <div>
    <div
      v-if="usersError"
      class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg mb-4"
    >
      {{ usersError }}
    </div>

    <!-- Loading -->
    <div v-if="usersLoading" class="space-y-2">
      <div v-for="i in 6" :key="i" class="h-12 bg-secondary rounded animate-pulse" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="users.length === 0"
      class="text-center py-12 text-muted-foreground text-sm"
    >
      暂无用户
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border text-left">
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              姓名
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              邮箱
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              租户角色
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              项目数
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              邮箱验证
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              注册时间
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs">
              项目详情
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="user in users" :key="user.id">
            <tr class="border-b border-border hover:bg-white/5 transition-colors duration-200">
              <td class="py-3 pr-4 font-medium text-foreground">{{ user.name }}</td>
              <td class="py-3 pr-4 text-muted-foreground text-xs font-mono">{{ user.email }}</td>
              <td class="py-3 pr-4">
                <select
                  :disabled="roleUpdateLoading[user.id] || rolesLoading"
                  :value="user.tenantRoleId ?? ''"
                  class="text-sm border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 transition-colors duration-200 cursor-pointer"
                  @change="updateTenantRole(user.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-if="!user.tenantRoleId" value="" disabled>
                    请选择角色
                  </option>
                  <option
                    v-for="role in tenantRoles"
                    :key="role.id"
                    :value="role.id"
                  >
                    {{ role.name }}
                  </option>
                </select>
              </td>
              <td class="py-3 pr-4 font-mono text-muted-foreground">
                {{ userProjects[user.id]?.length ?? '—' }}
              </td>
              <td class="py-3 pr-4">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="
                    user.isEmailVerified
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  "
                >
                  {{ user.isEmailVerified ? '已验证' : '未验证' }}
                </span>
              </td>
              <td class="py-3 pr-4 font-mono text-muted-foreground text-xs">
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="py-3">
                <button
                  class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                  @click="toggleUserProjects(user.id)"
                >
                  <span>展开</span>
                  <ChevronDown
                    class="w-3.5 h-3.5 transition-transform"
                    :class="expandedUserId === user.id ? 'rotate-180' : ''"
                  />
                </button>
              </td>
            </tr>

            <!-- 展开行：项目列表 -->
            <tr v-if="expandedUserId === user.id" class="bg-secondary/20">
              <td colspan="7" class="px-4 py-3">
                <div v-if="projectsLoading[user.id]" class="space-y-1">
                  <div v-for="i in 2" :key="i" class="h-8 bg-secondary rounded animate-pulse" />
                </div>
                <div
                  v-else-if="!userProjects[user.id] || userProjects[user.id].length === 0"
                  class="text-xs text-muted-foreground py-1"
                >
                  该用户暂无项目成员记录
                </div>
                <table v-else class="w-full text-xs">
                  <thead>
                    <tr class="text-muted-foreground border-b border-border">
                      <th class="pb-2 text-left font-medium pr-4">项目名称</th>
                      <th class="pb-2 text-left font-medium pr-4">状态</th>
                      <th class="pb-2 text-left font-medium pr-4">项目角色</th>
                      <th class="pb-2 text-left font-medium">加入时间</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr
                      v-for="proj in userProjects[user.id]"
                      :key="proj.projectId"
                      class="hover:bg-white/5 transition-colors duration-200"
                    >
                      <td class="py-2 pr-4 font-medium text-foreground">{{ proj.projectName }}</td>
                      <td class="py-2 pr-4 text-muted-foreground">{{ proj.projectStatus }}</td>
                      <td class="py-2 pr-4">
                        <select
                          :value="proj.projectRoleId"
                          :disabled="projectRoleUpdateLoading[`${user.id}:${proj.projectId}`]"
                          class="text-xs border border-border rounded px-1.5 py-0.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 cursor-pointer"
                          @change="
                            updateProjectRole(
                              user.id,
                              proj.projectId,
                              ($event.target as HTMLSelectElement).value,
                            )
                          "
                        >
                          <option
                            v-for="role in projectRoles"
                            :key="role.id"
                            :value="role.id"
                          >
                            {{ role.name }}
                          </option>
                        </select>
                      </td>
                      <td class="py-2 text-muted-foreground font-mono">
                        {{ formatDate(proj.joinedAt) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
