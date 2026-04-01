<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type InviteCode } from '@/services/admin';

const invites = ref<InviteCode[]>([]);
const loading = ref(false);
const error = ref('');
const toggleLoading = ref<Record<string, boolean>>({});

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
