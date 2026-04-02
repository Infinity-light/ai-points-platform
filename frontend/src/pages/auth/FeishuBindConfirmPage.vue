<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/lib/axios';

const router = useRouter();
const route = useRoute();

const token = computed(() => (route.query.token as string) ?? '');
const loading = ref(false);
const error = ref('');

interface DecodedPayload {
  feishuName?: string;
  matchedEmail?: string;
  email?: string;
  name?: string;
  sub?: string;
}

const decoded = ref<DecodedPayload | null>(null);

function decodeJwtPayload(jwt: string): DecodedPayload | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Pad base64 to a multiple of 4
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as DecodedPayload;
  } catch {
    return null;
  }
}

onMounted(() => {
  if (!token.value) {
    error.value = '缺少 token 参数';
    return;
  }
  decoded.value = decodeJwtPayload(token.value);
  if (!decoded.value) {
    error.value = 'token 解析失败，请重新发起飞书登录';
  }
});

interface LinkConfirmResponse {
  accessToken: string;
  refreshToken: string;
}

async function confirm(action: 'link' | 'create_new') {
  if (!token.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await api.post<LinkConfirmResponse>('/auth/feishu/link-confirm', {
      token: token.value,
      action,
    });
    localStorage.setItem('access_token', res.data.accessToken);
    localStorage.setItem('refresh_token', res.data.refreshToken);
    await router.push('/dashboard');
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    error.value = msg ?? '操作失败，请重新发起飞书登录';
  } finally {
    loading.value = false;
  }
}

const displayName = computed(() => decoded.value?.feishuName ?? decoded.value?.name ?? '飞书用户');
const displayEmail = computed(() => decoded.value?.matchedEmail ?? decoded.value?.email ?? '');
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-6">
    <div class="w-full max-w-sm">
      <div class="glass-card p-8">
        <h1 class="font-heading text-xl font-bold text-foreground mb-2">飞书账号绑定</h1>

        <div v-if="error" class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-md mb-4">
          {{ error }}
        </div>

        <template v-if="decoded && !error">
          <p class="text-sm text-muted-foreground mb-4">
            检测到飞书账号 <span class="font-medium text-foreground">{{ displayName }}</span>，
            <template v-if="displayEmail">
              与平台邮箱 <span class="font-medium text-foreground">{{ displayEmail }}</span> 匹配。
            </template>
            <template v-else>
              未找到匹配的平台账号。
            </template>
            请选择操作：
          </p>

          <div class="space-y-3">
            <button
              v-if="displayEmail"
              class="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
              :disabled="loading"
              @click="confirm('link')"
            >
              {{ loading ? '处理中...' : `确认绑定 ${displayEmail}` }}
            </button>
            <button
              class="w-full px-4 py-2.5 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer"
              :disabled="loading"
              @click="confirm('create_new')"
            >
              {{ loading ? '处理中...' : '创建新账号' }}
            </button>
          </div>
        </template>

        <template v-else-if="!decoded && !error">
          <div class="flex items-center justify-center py-8 text-muted-foreground text-sm">
            加载中...
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
