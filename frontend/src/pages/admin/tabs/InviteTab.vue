<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type InviteCode, type CreateInvitePayload } from '@/services/admin';
import { Plus, ChevronDown, ChevronUp } from 'lucide-vue-next';

const invites = ref<InviteCode[]>([]);
const loading = ref(false);
const error = ref('');
const toggleLoading = ref<Record<string, boolean>>({});

const showCreateForm = ref(false);
const createLoading = ref(false);
const createError = ref('');
const createSuccess = ref('');

const form = ref<CreateInvitePayload>({
  maxUses: 10,
  expiresAt: '',
  note: '',
});

async function loadInvites() {
  loading.value = true;
  error.value = '';
  try {
    invites.value = await adminApi.listInvites();
  } catch {
    error.value = '加载邀请码失败，请刷新重试';
  } finally {
    loading.value = false;
  }
}

async function submitCreate() {
  createLoading.value = true;
  createError.value = '';
  createSuccess.value = '';
  try {
    const payload: CreateInvitePayload = {
      maxUses: form.value.maxUses,
    };
    if (form.value.expiresAt) {
      payload.expiresAt = new Date(form.value.expiresAt).toISOString();
    }
    if (form.value.note?.trim()) {
      payload.note = form.value.note.trim();
    }
    const created = await adminApi.createInvite(payload);
    createSuccess.value = `邀请码已创建：${created.code}`;
    form.value = { maxUses: 10, expiresAt: '', note: '' };
    showCreateForm.value = false;
    await loadInvites();
  } catch {
    createError.value = '创建失败，请重试';
  } finally {
    createLoading.value = false;
  }
}

async function toggleInvite(id: string, isActive: boolean) {
  toggleLoading.value[id] = true;
  error.value = '';
  try {
    const updated = await adminApi.toggleInvite(id, isActive);
    const idx = invites.value.findIndex((i) => i.id === id);
    if (idx !== -1) {
      invites.value[idx] = updated;
    }
  } catch {
    error.value = '操作失败，请重试';
  } finally {
    toggleLoading.value[id] = false;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '永不过期';
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

onMounted(() => {
  void loadInvites();
});
</script>

<template>
  <div>
    <!-- 操作区 -->
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-muted-foreground">管理租户邀请码</p>
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150"
        @click="showCreateForm = !showCreateForm"
      >
        <Plus class="w-4 h-4" />
        创建邀请码
        <ChevronUp v-if="showCreateForm" class="w-3.5 h-3.5" />
        <ChevronDown v-else class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- 创建表单 -->
    <div
      v-if="showCreateForm"
      class="glass-card p-5 mb-5 border border-primary/20"
    >
      <h3 class="text-sm font-semibold text-foreground mb-4">创建新邀请码</h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <!-- 最大使用次数 -->
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">最大使用次数</label>
          <input
            v-model.number="form.maxUses"
            type="number"
            min="1"
            max="1000"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="默认 10"
          />
        </div>

        <!-- 过期时间 -->
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">过期时间（可选）</label>
          <input
            v-model="form.expiresAt"
            type="date"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <!-- 备注 -->
        <div class="sm:col-span-2">
          <label class="block text-xs text-muted-foreground mb-1.5">备注（可选）</label>
          <input
            v-model="form.note"
            type="text"
            maxlength="255"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="例：新员工入职邀请"
          />
        </div>
      </div>

      <p v-if="createError" class="text-xs text-destructive mb-3">{{ createError }}</p>

      <div class="flex gap-2 justify-end">
        <button
          class="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-white/5 transition-colors duration-150"
          @click="showCreateForm = false"
        >
          取消
        </button>
        <button
          class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="createLoading"
          @click="submitCreate"
        >
          {{ createLoading ? '创建中...' : '确认创建' }}
        </button>
      </div>
    </div>

    <!-- 成功提示 -->
    <div
      v-if="createSuccess"
      class="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg mb-4"
    >
      {{ createSuccess }}
    </div>

    <!-- 错误提示 -->
    <div
      v-if="error"
      class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg mb-4"
    >
      {{ error }}
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-12 bg-secondary rounded animate-pulse" />
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
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              邀请码
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              备注
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              使用次数
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              状态
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs pr-4">
              过期时间
            </th>
            <th class="pb-3 font-medium text-muted-foreground uppercase tracking-wider text-xs">
              操作
            </th>
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
            <td class="py-3 pr-4 font-mono text-muted-foreground">
              {{ formatDate(invite.expiresAt) }}
            </td>
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
</template>
