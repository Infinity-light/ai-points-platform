<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/services/auth';
import FormField from '@/components/ui/FormField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  tenantSlug: '',
  email: '',
  password: '',
});

const errors = reactive({
  tenantSlug: '',
  email: '',
  password: '',
  global: '',
});

const loading = ref(false);
const showPassword = ref(false);

function validate(): boolean {
  errors.tenantSlug = form.tenantSlug.trim() ? '' : '请输入组织标识';
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? '' : '请输入有效的邮箱地址';
  errors.password = form.password.length >= 8 ? '' : '密码至少8位';
  errors.global = '';
  return !errors.tenantSlug && !errors.email && !errors.password;
}

async function handleSubmit() {
  if (!validate() || loading.value) return;
  loading.value = true;
  errors.global = '';
  try {
    const res = await authApi.login({
      email: form.email,
      password: form.password,
      tenantSlug: form.tenantSlug.trim(),
    });
    authStore.setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
    await router.push('/dashboard');
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    errors.global = msg ?? '登录失败，请检查您的凭据';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="w-full max-w-md">
      <!-- Logo / Title -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
          <svg class="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-foreground">AI 积分平台</h1>
        <p class="text-sm text-muted-foreground mt-1">登录您的账号</p>
      </div>

      <!-- Card -->
      <div class="bg-card border border-border rounded-xl p-8 shadow-sm">
        <form @submit.prevent="handleSubmit" class="space-y-5" novalidate>
          <!-- Global error -->
          <div v-if="errors.global"
            class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-md">
            {{ errors.global }}
          </div>

          <FormField label="组织标识" :error="errors.tenantSlug" required>
            <BaseInput
              v-model="form.tenantSlug"
              placeholder="例如：shenbi-team"
              :error="!!errors.tenantSlug"
              autocomplete="organization"
              @input="errors.tenantSlug = ''"
            />
          </FormField>

          <FormField label="邮箱" :error="errors.email" required>
            <BaseInput
              v-model="form.email"
              type="email"
              placeholder="your@email.com"
              :error="!!errors.email"
              autocomplete="email"
              @input="errors.email = ''"
            />
          </FormField>

          <FormField label="密码" :error="errors.password" required>
            <div class="relative">
              <BaseInput
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                :error="!!errors.password"
                autocomplete="current-password"
                @input="errors.password = ''"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                @click="showPassword = !showPassword"
              >
                <svg v-if="!showPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
          </FormField>

          <BaseButton type="submit" class="w-full" size="lg" :loading="loading">
            登录
          </BaseButton>
        </form>

        <p class="text-center text-sm text-muted-foreground mt-6">
          还没有账号？
          <router-link to="/register" class="text-primary font-medium hover:underline">
            立即注册
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
