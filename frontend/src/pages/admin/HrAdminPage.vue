<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type AdminUser, type InviteCode, type TenantStats } from '@/services/admin';
import { approvalApi, type ApprovalBatch, type ApprovalBatchDetail } from '@/services/points';
import BaseButton from '@/components/ui/BaseButton.vue';
import { ChevronDown } from 'lucide-vue-next';

type AdminTab = 'users' | 'invites' | 'stats' | 'approvals';

const activeTab = ref<AdminTab>('users');

// ─── Users tab ───────────────────────────────────────────────────────────────
const users = ref<AdminUser[]>([]);
const usersLoading = ref(false);
const usersError = ref('');
const roleUpdateLoading = ref<Record<string, boolean>>({});

// ─── Invites tab ─────────────────────────────────────────────────────────────
const invites = ref<InviteCode[]>([]);
const invitesLoading = ref(false);
const invitesError = ref('');
const toggleLoading = ref<Record<string, boolean>>({});

// ─── Stats tab ───────────────────────────────────────────────────────────────
const stats = ref<TenantStats | null>(null);
const statsLoading = ref(false);
const statsError = ref('');

// ─── Approvals tab ───────────────────────────────────────────────────────────
const approvalBatches = ref<ApprovalBatch[]>([]);
const approvalsLoading = ref(false);
const approvalsError = ref('');
const expandedBatchId = ref<string | null>(null);
const batchDetail = ref<ApprovalBatchDetail | null>(null);
const batchDetailLoading = ref(false);
const rejectNoteTarget = ref<string | null>(null);
const rejectNoteValue = ref('');
const actionLoading = ref<Record<string, boolean>>({});

const availableRoles = [
  { value: 'employee', label: '普通员工' },
  { value: 'project_lead', label: '项目负责人' },
  { value: 'hr_admin', label: 'HR管理员' },
];

// ─── Users ───────────────────────────────────────────────────────────────────
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

// ─── Invites ─────────────────────────────────────────────────────────────────
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

// ─── Stats ───────────────────────────────────────────────────────────────────
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

// ─── Approvals ───────────────────────────────────────────────────────────────
async function loadApprovals() {
  approvalsLoading.value = true;
  approvalsError.value = '';
  try {
    const res = await approvalApi.list();
    approvalBatches.value = res.data;
  } catch {
    approvalsError.value = '加载审批队列失败，请刷新重试';
  } finally {
    approvalsLoading.value = false;
  }
}

async function toggleBatchDetail(batch: ApprovalBatch) {
  if (expandedBatchId.value === batch.id) {
    expandedBatchId.value = null;
    batchDetail.value = null;
    return;
  }
  expandedBatchId.value = batch.id;
  batchDetailLoading.value = true;
  try {
    const res = await approvalApi.get(batch.id);
    batchDetail.value = res.data;
  } catch {
    batchDetail.value = null;
  } finally {
    batchDetailLoading.value = false;
  }
}

async function approveBatch(batchId: string) {
  actionLoading.value[batchId] = true;
  approvalsError.value = '';
  try {
    const res = await approvalApi.approve(batchId);
    const idx = approvalBatches.value.findIndex((b) => b.id === batchId);
    if (idx !== -1) approvalBatches.value[idx] = res.data;
  } catch {
    approvalsError.value = '审批操作失败，请重试';
  } finally {
    actionLoading.value[batchId] = false;
  }
}

function openRejectNote(batchId: string) {
  rejectNoteTarget.value = batchId;
  rejectNoteValue.value = '';
}

async function submitReject() {
  if (!rejectNoteTarget.value) return;
  const batchId = rejectNoteTarget.value;
  actionLoading.value[batchId] = true;
  approvalsError.value = '';
  try {
    const res = await approvalApi.reject({
      id: batchId,
      reviewNote: rejectNoteValue.value || undefined,
    });
    const idx = approvalBatches.value.findIndex((b) => b.id === batchId);
    if (idx !== -1) approvalBatches.value[idx] = res.data;
    rejectNoteTarget.value = null;
  } catch {
    approvalsError.value = '驳回操作失败，请重试';
  } finally {
    actionLoading.value[batchId] = false;
  }
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab: AdminTab) {
  activeTab.value = tab;
  if (tab === 'users' && users.value.length === 0) loadUsers();
  if (tab === 'invites' && invites.value.length === 0) loadInvites();
  if (tab === 'stats' && !stats.value) loadStats();
  if (tab === 'approvals' && approvalBatches.value.length === 0) loadApprovals();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return '永不过期';
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

function roleLabel(role: string) {
  return availableRoles.find((r) => r.value === role)?.label ?? role;
}

const approvalStatusConfig: Record<
  ApprovalBatch['status'],
  { label: string; class: string }
> = {
  pending: { label: '待审批', class: 'bg-yellow-500/10 text-yellow-400' },
  approved: { label: '已批准', class: 'bg-green-500/10 text-green-400' },
  rejected: { label: '已驳回', class: 'bg-destructive/10 text-destructive' },
};

onMounted(() => {
  loadUsers();
});
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-heading font-bold text-foreground">管理后台</h1>
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
            { key: 'approvals', label: '工分审批' },
          ]"
          :key="tab.key"
          class="pb-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px cursor-pointer"
          :class="
            activeTab === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="switchTab(tab.key as AdminTab)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Users Tab -->
    <div v-if="activeTab === 'users'">
      <div v-if="usersLoading" class="space-y-2">
        <div v-for="i in 5" :key="i" class="h-12 bg-secondary rounded animate-pulse" />
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
            <tr class="border-b border-border text-left">
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">姓名</th>
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">邮箱</th>
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">角色</th>
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">邮箱验证</th>
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs">注册时间</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="user in users"
              :key="user.id"
              class="hover:bg-white/5 transition-colors duration-200"
            >
              <td class="py-3 pr-4 font-medium text-foreground">{{ user.name }}</td>
              <td class="py-3 pr-4 text-muted-foreground">{{ user.email }}</td>
              <td class="py-3 pr-4">
                <select
                  :value="user.role"
                  :disabled="roleUpdateLoading[user.id]"
                  class="text-sm border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 transition-colors duration-200 cursor-pointer"
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
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  "
                >
                  {{ user.isEmailVerified ? '已验证' : '未验证' }}
                </span>
              </td>
              <td class="py-3 font-mono text-muted-foreground">{{ formatDate(user.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Invites Tab -->
    <div v-else-if="activeTab === 'invites'">
      <div v-if="invitesLoading" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-12 bg-secondary rounded animate-pulse" />
      </div>
      <div
        v-else-if="invitesError"
        class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
      >
        {{ invitesError }}
      </div>
      <div
        v-else-if="invites.length === 0"
        class="text-center py-12 text-muted-foreground text-sm"
      >
        暂无邀请码
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left">
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">邀请码</th>
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">备注</th>
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">使用次数</th>
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">状态</th>
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">过期时间</th>
              <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="invite in invites"
              :key="invite.id"
              class="hover:bg-white/5 transition-colors duration-200"
            >
              <td class="py-3 pr-4 font-mono font-medium text-foreground">{{ invite.code }}</td>
              <td class="py-3 pr-4 text-muted-foreground">{{ invite.note ?? '—' }}</td>
              <td class="py-3 pr-4 font-mono text-muted-foreground">
                {{ invite.usedCount }} / {{ invite.maxUses }}
              </td>
              <td class="py-3 pr-4">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="
                    invite.isActive
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-secondary text-muted-foreground'
                  "
                >
                  {{ invite.isActive ? '启用' : '停用' }}
                </span>
              </td>
              <td class="py-3 pr-4 font-mono text-muted-foreground">{{ formatDate(invite.expiresAt) }}</td>
              <td class="py-3">
                <button
                  :disabled="toggleLoading[invite.id]"
                  class="text-xs px-3 py-1 rounded border border-border hover:bg-white/5 transition-colors duration-200 disabled:opacity-50 cursor-pointer"
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
        <div v-for="i in 3" :key="i" class="h-28 bg-secondary rounded-lg animate-pulse" />
      </div>
      <div
        v-else-if="statsError"
        class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg"
      >
        {{ statsError }}
      </div>
      <div v-else-if="stats">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="glass-card p-5">
            <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider">总用户数</p>
            <p class="text-3xl font-mono font-bold text-foreground mt-1">{{ stats.totalUsers }}</p>
          </div>
          <div class="glass-card p-5">
            <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider">累计发放工分</p>
            <p class="text-3xl font-mono font-bold text-foreground mt-1">{{ stats.totalPointsAwarded }}</p>
          </div>
          <div class="glass-card p-5">
            <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider">有效邀请码</p>
            <p class="text-3xl font-mono font-bold text-foreground mt-1">{{ stats.activeInviteCodes }}</p>
          </div>
        </div>
        <div class="glass-card p-5">
          <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">角色分布</h3>
          <div class="space-y-3">
            <div
              v-for="(count, role) in stats.usersByRole"
              :key="role"
              class="flex items-center justify-between"
            >
              <span class="text-sm text-muted-foreground">{{ roleLabel(String(role)) }}</span>
              <div class="flex items-center gap-3">
                <div class="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    class="h-full bg-primary rounded-full"
                    :style="{
                      width: stats.totalUsers > 0 ? `${(count / stats.totalUsers) * 100}%` : '0%',
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

    <!-- Approvals Tab -->
    <div v-else-if="activeTab === 'approvals'">
      <div v-if="approvalsLoading" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-16 bg-secondary rounded animate-pulse" />
      </div>
      <div
        v-else-if="approvalsError"
        class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg mb-4"
      >
        {{ approvalsError }}
      </div>
      <div
        v-if="!approvalsLoading && approvalBatches.length === 0"
        class="text-center py-12 text-muted-foreground text-sm"
      >
        暂无待审批工分批次
      </div>
      <div v-else-if="!approvalsLoading" class="space-y-2">
        <div
          v-for="batch in approvalBatches"
          :key="batch.id"
          class="glass-card overflow-hidden"
        >
          <!-- Batch row -->
          <div
            class="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors duration-200"
            @click="toggleBatchDetail(batch)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-sm font-medium text-foreground truncate">
                  {{ batch.projectName ?? '未知项目' }}
                </span>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="approvalStatusConfig[batch.status].class"
                >
                  {{ approvalStatusConfig[batch.status].label }}
                </span>
              </div>
              <p class="text-xs text-muted-foreground">
                提交人：{{ batch.submitterName ?? batch.submittedBy }} ·
                {{ formatDateTime(batch.createdAt) }}
              </p>
            </div>

            <div class="text-right shrink-0">
              <p class="text-sm font-mono font-medium text-foreground">{{ batch.totalPoints }} 分</p>
              <p class="text-xs text-muted-foreground">{{ batch.pointRecordIds.length }} 条记录</p>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-2 shrink-0" @click.stop>
              <BaseButton
                v-if="batch.status === 'pending'"
                size="sm"
                class="transition-colors duration-200"
                :loading="actionLoading[batch.id]"
                @click="approveBatch(batch.id)"
              >
                批准
              </BaseButton>
              <BaseButton
                v-if="batch.status === 'pending'"
                size="sm"
                variant="outline"
                class="transition-colors duration-200"
                :loading="actionLoading[batch.id]"
                @click="openRejectNote(batch.id)"
              >
                驳回
              </BaseButton>
            </div>

            <!-- Expand arrow -->
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform shrink-0"
              :class="expandedBatchId === batch.id ? 'rotate-180' : ''"
            />
          </div>

          <!-- Expanded detail -->
          <div
            v-if="expandedBatchId === batch.id"
            class="border-t border-border px-4 py-3"
          >
            <div v-if="batchDetailLoading" class="space-y-2">
              <div v-for="i in 3" :key="i" class="h-8 bg-secondary rounded animate-pulse" />
            </div>
            <div v-else-if="batchDetail">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                工分明细
              </p>
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-muted-foreground border-b border-border">
                    <th class="pb-2 font-medium">任务名</th>
                    <th class="pb-2 font-medium text-right">工分</th>
                    <th class="pb-2 font-medium text-right">获得时间</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr
                    v-for="record in batchDetail.pointRecords"
                    :key="record.id"
                    class="hover:bg-white/5 transition-colors duration-200"
                  >
                    <td class="py-2 text-foreground">{{ record.taskTitle }}</td>
                    <td class="py-2 text-right font-mono font-medium text-primary">{{ record.points }}</td>
                    <td class="py-2 text-right font-mono text-muted-foreground">
                      {{ formatDateTime(record.acquiredAt) }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="batch.reviewNote" class="mt-3 text-xs text-muted-foreground">
                审批备注：{{ batch.reviewNote }}
              </div>
            </div>
            <div v-else class="text-xs text-muted-foreground py-2">加载明细失败</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Reject Note Modal -->
  <div
    v-if="rejectNoteTarget"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="rejectNoteTarget = null"
  >
    <div class="glass-card shadow-xl w-full max-w-sm mx-4 p-6">
      <h3 class="font-heading font-semibold text-foreground mb-4">驳回工分批次</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-muted-foreground mb-1">驳回备注（可选）</label>
          <textarea
            v-model="rejectNoteValue"
            rows="3"
            placeholder="填写驳回原因..."
            class="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-colors duration-200"
          />
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <BaseButton
          class="flex-1 transition-colors duration-200"
          variant="outline"
          :loading="rejectNoteTarget ? actionLoading[rejectNoteTarget] : false"
          @click="submitReject"
        >
          确认驳回
        </BaseButton>
        <BaseButton variant="ghost" class="flex-1 transition-colors duration-200" @click="rejectNoteTarget = null">
          取消
        </BaseButton>
      </div>
    </div>
  </div>
</template>
