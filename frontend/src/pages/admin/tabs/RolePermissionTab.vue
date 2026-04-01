<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { rbacApi, type RoleDto } from '@/services/rbac';
import { Plus, Save, Loader2 } from 'lucide-vue-next';

// 资源列表
const RESOURCES = [
  'users',
  'projects',
  'tasks',
  'points',
  'votes',
  'settlements',
  'dividends',
  'tenants',
  'config',
  'audit',
  'bulletin',
  'auctions',
  'roles',
] as const;

// 标准动作 + 特殊动作（按资源）
const BASE_ACTIONS = ['read', 'create', 'update', 'delete'] as const;

const SPECIAL_ACTIONS: Record<string, string[]> = {
  points: ['approve'],
  settlements: ['trigger'],
  votes: ['manage'],
  auctions: ['bid'],
};

function actionsForResource(resource: string): string[] {
  const special = SPECIAL_ACTIONS[resource] ?? [];
  return [...BASE_ACTIONS, ...special];
}

// 资源中文名
const RESOURCE_LABELS: Record<string, string> = {
  users: '用户',
  projects: '项目',
  tasks: '任务',
  points: '工分',
  votes: '投票',
  settlements: '结算',
  dividends: '分红',
  tenants: '租户',
  config: '全局配置',
  audit: '审计日志',
  bulletin: '公示区',
  auctions: '竞拍',
  roles: '角色权限',
};

const ACTION_LABELS: Record<string, string> = {
  read: '查看',
  create: '创建',
  update: '修改',
  delete: '删除',
  approve: '审批',
  trigger: '触发',
  manage: '管理',
  bid: '竞价',
};

// 所有唯一动作（列头）
const ALL_ACTIONS = computed(() => {
  const set = new Set<string>([...BASE_ACTIONS]);
  Object.values(SPECIAL_ACTIONS).forEach((actions) => {
    actions.forEach((a) => set.add(a));
  });
  return Array.from(set);
});

// ─── 角色列表 ──────────────────────────────────────────────────────────────
const roles = ref<RoleDto[]>([]);
const rolesLoading = ref(false);
const selectedRoleId = ref<string | null>(null);
const selectedRole = computed(() => roles.value.find((r) => r.id === selectedRoleId.value) ?? null);

// ─── 权限矩阵 ──────────────────────────────────────────────────────────────
// permMatrix[resource][action] = boolean
const permMatrix = ref<Record<string, Record<string, boolean>>>({});
const matrixLoading = ref(false);
const matrixSaving = ref(false);
const matrixError = ref('');
const matrixSuccess = ref(false);

// ─── 新建角色模态框 ────────────────────────────────────────────────────────
const showCreateModal = ref(false);
const newRoleName = ref('');
const newRoleDesc = ref('');
const newRoleScope = ref<'tenant' | 'project'>('tenant');
const createLoading = ref(false);
const createError = ref('');

async function loadRoles() {
  rolesLoading.value = true;
  try {
    roles.value = await rbacApi.listRoles();
  } catch {
    // 静默失败
  } finally {
    rolesLoading.value = false;
  }
}

function initMatrix() {
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const resource of RESOURCES) {
    matrix[resource] = {};
    for (const action of ALL_ACTIONS.value) {
      matrix[resource][action] = false;
    }
  }
  return matrix;
}

async function selectRole(roleId: string) {
  selectedRoleId.value = roleId;
  matrixLoading.value = true;
  matrixError.value = '';
  matrixSuccess.value = false;

  const matrix = initMatrix();
  try {
    const perms = await rbacApi.getPermissions(roleId);
    for (const p of perms) {
      if (matrix[p.resource]) {
        matrix[p.resource][p.action] = true;
      }
    }
  } catch {
    matrixError.value = '加载权限失败';
  } finally {
    permMatrix.value = matrix;
    matrixLoading.value = false;
  }
}

function togglePerm(resource: string, action: string) {
  if (!permMatrix.value[resource]) return;
  // 检查该资源是否有此动作
  const resourceActions = actionsForResource(resource);
  if (!resourceActions.includes(action)) return;
  permMatrix.value[resource][action] = !permMatrix.value[resource][action];
}

function isActionAvailable(resource: string, action: string): boolean {
  return actionsForResource(resource).includes(action);
}

async function savePermissions() {
  if (!selectedRoleId.value) return;
  matrixSaving.value = true;
  matrixError.value = '';
  matrixSuccess.value = false;

  const permissions: Array<{ resource: string; action: string }> = [];
  for (const resource of RESOURCES) {
    for (const action of ALL_ACTIONS.value) {
      if (permMatrix.value[resource]?.[action] && isActionAvailable(resource, action)) {
        permissions.push({ resource, action });
      }
    }
  }

  try {
    await rbacApi.setPermissions(selectedRoleId.value, permissions);
    matrixSuccess.value = true;
    setTimeout(() => { matrixSuccess.value = false; }, 2000);
  } catch {
    matrixError.value = '保存失败，请重试';
  } finally {
    matrixSaving.value = false;
  }
}

async function createRole() {
  if (!newRoleName.value.trim()) return;
  createLoading.value = true;
  createError.value = '';
  try {
    const created = await rbacApi.createRole({
      name: newRoleName.value.trim(),
      description: newRoleDesc.value.trim() || undefined,
      scope: newRoleScope.value,
    });
    roles.value.push(created);
    showCreateModal.value = false;
    newRoleName.value = '';
    newRoleDesc.value = '';
    newRoleScope.value = 'tenant';
    void selectRole(created.id);
  } catch (err: unknown) {
    createError.value = (err as Error).message ?? '创建失败，请重试';
  } finally {
    createLoading.value = false;
  }
}

onMounted(() => {
  void loadRoles();
});
</script>

<template>
  <div class="flex gap-6 min-h-[500px]">
    <!-- 左侧角色列表 -->
    <div class="w-56 shrink-0">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-medium text-foreground">角色列表</h3>
        <button
          class="p-1 rounded hover:bg-white/10 transition-colors duration-200 text-muted-foreground hover:text-foreground cursor-pointer"
          title="新建角色"
          @click="showCreateModal = true"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <div v-if="rolesLoading" class="space-y-1.5">
        <div v-for="i in 5" :key="i" class="h-8 bg-secondary rounded animate-pulse" />
      </div>

      <nav v-else class="space-y-1">
        <button
          v-for="role in roles"
          :key="role.id"
          class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-200 cursor-pointer"
          :class="
            selectedRoleId === role.id
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          "
          @click="selectRole(role.id)"
        >
          <span class="block truncate font-medium">{{ role.name }}</span>
          <span class="block text-xs opacity-70">
            {{ role.scope === 'tenant' ? '租户级' : '项目级' }}
            {{ role.isSystem ? ' · 系统' : '' }}
          </span>
        </button>

        <p v-if="roles.length === 0" class="text-xs text-muted-foreground px-2 py-1">暂无角色</p>
      </nav>
    </div>

    <!-- 右侧权限矩阵 -->
    <div class="flex-1 min-w-0">
      <div v-if="!selectedRole" class="flex items-center justify-center h-full text-muted-foreground text-sm">
        请从左侧选择一个角色
      </div>

      <template v-else>
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-medium text-foreground">{{ selectedRole.name }}</h3>
            <p class="text-xs text-muted-foreground">
              {{ selectedRole.description ?? '无描述' }} ·
              {{ selectedRole.scope === 'tenant' ? '租户级' : '项目级' }}
            </p>
          </div>
          <button
            class="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200 cursor-pointer"
            :disabled="matrixSaving || selectedRole.isSystem"
            :title="selectedRole.isSystem ? '系统内置角色权限不可修改' : ''"
            @click="savePermissions"
          >
            <Loader2 v-if="matrixSaving" class="w-4 h-4 animate-spin" />
            <Save v-else class="w-4 h-4" />
            <span>{{ matrixSaving ? '保存中...' : '保存权限' }}</span>
          </button>
        </div>

        <p v-if="matrixError" class="text-sm text-destructive mb-3">{{ matrixError }}</p>
        <p v-if="matrixSuccess" class="text-sm text-green-400 mb-3">权限已保存</p>
        <p v-if="selectedRole.isSystem" class="text-xs text-yellow-400 mb-3">
          系统内置角色权限不可修改
        </p>

        <div v-if="matrixLoading" class="space-y-2">
          <div v-for="i in 8" :key="i" class="h-10 bg-secondary rounded animate-pulse" />
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left pb-2 pr-4 font-medium text-muted-foreground w-24">资源</th>
                <th
                  v-for="action in ALL_ACTIONS"
                  :key="action"
                  class="pb-2 px-2 font-medium text-muted-foreground text-center w-16"
                >
                  {{ ACTION_LABELS[action] ?? action }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr
                v-for="resource in RESOURCES"
                :key="resource"
                class="hover:bg-white/5 transition-colors duration-200"
              >
                <td class="py-2.5 pr-4 font-medium text-foreground">
                  {{ RESOURCE_LABELS[resource] ?? resource }}
                </td>
                <td
                  v-for="action in ALL_ACTIONS"
                  :key="action"
                  class="py-2.5 px-2 text-center"
                >
                  <input
                    v-if="isActionAvailable(resource, action)"
                    type="checkbox"
                    :checked="permMatrix[resource]?.[action] ?? false"
                    :disabled="selectedRole.isSystem"
                    class="w-4 h-4 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    @change="togglePerm(resource, action)"
                  />
                  <span v-else class="text-muted-foreground/30">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>

  <!-- 新建角色模态框 -->
  <div
    v-if="showCreateModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="showCreateModal = false"
  >
    <div class="glass-card shadow-xl w-full max-w-sm mx-4 p-6">
      <h3 class="font-heading font-semibold text-foreground mb-4">新建角色</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-muted-foreground mb-1">角色名称</label>
          <input
            v-model="newRoleName"
            type="text"
            placeholder="例：项目经理"
            class="w-full px-3 py-2 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors duration-200"
          />
        </div>
        <div>
          <label class="block text-sm text-muted-foreground mb-1">描述（可选）</label>
          <input
            v-model="newRoleDesc"
            type="text"
            placeholder="角色描述..."
            class="w-full px-3 py-2 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors duration-200"
          />
        </div>
        <div>
          <label class="block text-sm text-muted-foreground mb-1">范围</label>
          <select
            v-model="newRoleScope"
            class="w-full px-3 py-2 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors duration-200"
          >
            <option value="tenant">租户级</option>
            <option value="project">项目级</option>
          </select>
        </div>
        <p v-if="createError" class="text-sm text-destructive">{{ createError }}</p>
      </div>
      <div class="flex gap-2 mt-4">
        <button
          class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200 cursor-pointer"
          :disabled="createLoading || !newRoleName.trim()"
          @click="createRole"
        >
          {{ createLoading ? '创建中...' : '确认创建' }}
        </button>
        <button
          class="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200 cursor-pointer"
          @click="showCreateModal = false; createError = ''"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>
