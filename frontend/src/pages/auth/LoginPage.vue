<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/services/auth';
import FormField from '@/components/ui/FormField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import SpaceBackground from '@/components/SpaceBackground.vue';
import { Rocket, Brain, Shield, TrendingUp, Eye, EyeOff } from 'lucide-vue-next';

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

      <!-- Center: Hero -->
      <div class="flex-1 flex flex-col justify-center max-w-lg">
        <h2 class="font-heading text-4xl xl:text-5xl font-bold text-foreground leading-tight mb-6">
          让每一颗创新的种子<br/>
          <span class="text-lunar">生根发芽</span>
        </h2>
        <p class="text-lg text-muted-foreground leading-relaxed">
          向赛博时代的乌托邦砥砺前行
        </p>
      </div>

      <!-- Bottom: Features -->
      <div class="grid grid-cols-3 gap-6">
        <div class="flex flex-col gap-2">
          <div class="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain class="w-4 h-4 text-primary" />
          </div>
          <p class="text-sm font-medium text-foreground">AI 智能评审</p>
          <p class="text-xs text-muted-foreground">三维度自动评分</p>
        </div>
        <div class="flex flex-col gap-2">
          <div class="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Shield class="w-4 h-4 text-accent" />
          </div>
          <p class="text-sm font-medium text-foreground">公平工分</p>
          <p class="text-xs text-muted-foreground">退火机制防固化</p>
        </div>
        <div class="flex flex-col gap-2">
          <div class="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <TrendingUp class="w-4 h-4 text-green-400" />
          </div>
          <p class="text-sm font-medium text-foreground">智能分派</p>
          <p class="text-xs text-muted-foreground">AI 驱动任务匹配</p>
        </div>
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
