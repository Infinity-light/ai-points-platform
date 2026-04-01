<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/services/auth';
import FormField from '@/components/ui/FormField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import SpaceBackground from '@/components/SpaceBackground.vue';
import { Rocket, Eye, EyeOff } from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  tenantSlug: '',
  email: '',
  password: '',
});

onMounted(() => {
  const savedSlug = localStorage.getItem('last_tenant_slug');
  const savedEmail = localStorage.getItem('last_email');
  if (savedSlug) form.tenantSlug = savedSlug;
  if (savedEmail) form.email = savedEmail;
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
    localStorage.setItem('last_tenant_slug', form.tenantSlug.trim());
    localStorage.setItem('last_email', form.email);
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
  <div class="relative min-h-screen grid grid-cols-1 lg:grid-cols-2">
    <SpaceBackground />

    <!-- Left: Brand Panel -->
    <div class="relative z-10 hidden lg:flex flex-col justify-between p-12 xl:p-16">
      <!-- Top: Logo -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Rocket class="w-5 h-5 text-primary" />
        </div>
        <div>
          <span class="font-heading text-lg font-semibold text-foreground">赛托邦</span>
          <span class="text-xs text-muted-foreground tracking-wider ml-2 uppercase">Cytopia</span>
        </div>
      </div>

      <!-- Center: Rocket Illustration -->
      <div class="flex-1 flex items-center justify-center">
        <div class="relative">
          <div class="absolute inset-0 -m-20 rounded-full bg-primary/5 blur-3xl"></div>
          <div class="relative w-72 h-72 xl:w-80 xl:h-80 rounded-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08] flex items-center justify-center">
            <div class="absolute top-10 left-14 w-10 h-10 rounded-full bg-white/[0.04]"></div>
            <div class="absolute bottom-16 right-10 w-14 h-14 rounded-full bg-white/[0.03]"></div>
            <div class="absolute top-20 right-16 w-6 h-6 rounded-full bg-white/[0.04]"></div>
            <Rocket class="w-20 h-20 xl:w-24 xl:h-24 text-primary -rotate-45" style="filter: drop-shadow(0 0 24px hsl(var(--primary) / 0.4))" />
          </div>
          <div class="absolute -top-6 left-8 w-2 h-2 rounded-full bg-primary/50 animate-pulse"></div>
          <div class="absolute top-12 -right-8 w-1.5 h-1.5 rounded-full bg-accent/50 animate-pulse" style="animation-delay: 0.5s"></div>
          <div class="absolute -bottom-4 left-20 w-1 h-1 rounded-full bg-primary/40 animate-pulse" style="animation-delay: 1s"></div>
        </div>
      </div>

      <!-- Bottom -->
      <div class="text-xs text-muted-foreground">
        &copy; {{ new Date().getFullYear() }} Cytopia. All rights reserved.
      </div>
    </div>

    <!-- Right: Login Form -->
    <div class="relative z-10 flex items-center justify-center p-6 sm:p-8 lg:p-12">
      <div class="w-full max-w-sm">
        <!-- Mobile brand (lg hidden) -->
        <div class="text-center mb-8 lg:hidden">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 mb-4">
            <Rocket class="w-6 h-6 text-primary" />
          </div>
          <h1 class="font-heading text-2xl font-bold text-foreground">赛托邦 Cytopia</h1>
          <p class="text-sm text-muted-foreground mt-1">登录您的账号</p>
        </div>

        <!-- Desktop subtitle -->
        <div class="hidden lg:block mb-8">
          <h1 class="font-heading text-2xl font-bold text-foreground">欢迎回来</h1>
          <p class="text-sm text-muted-foreground mt-1">登录您的赛托邦账号</p>
        </div>

        <!-- Form Card -->
        <div class="glass-card p-8">
          <form @submit.prevent="handleSubmit" class="space-y-5" novalidate>
            <div v-if="errors.global"
              class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-md">
              {{ errors.global }}
            </div>

            <FormField label="组织标识" :error="errors.tenantSlug" required>
              <BaseInput
                v-model="form.tenantSlug"
                placeholder="例如：cytopia"
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
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="!showPassword" class="w-4 h-4" />
                  <Eye v-else class="w-4 h-4" />
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
  </div>
</template>
