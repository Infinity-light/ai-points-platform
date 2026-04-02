<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/services/auth';
import { feishuConfigApi } from '@/services/feishu-config';
import FormField from '@/components/ui/FormField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import SpaceBackground from '@/components/SpaceBackground.vue';
import { Eye, EyeOff } from 'lucide-vue-next';

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
const feishuEnabled = ref(false);

async function checkFeishuEnabled(slug: string) {
  if (!slug.trim()) {
    feishuEnabled.value = false;
    return;
  }
  try {
    const res = await feishuConfigApi.checkFeishuEnabled(slug.trim());
    feishuEnabled.value = res.enabled;
  } catch {
    feishuEnabled.value = false;
  }
}

watch(() => form.tenantSlug, (slug) => {
  void checkFeishuEnabled(slug);
});

function loginWithFeishu() {
  window.location.href = `/api/auth/feishu?tenantSlug=${encodeURIComponent(form.tenantSlug.trim())}`;
}

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
    <div class="relative z-10 hidden lg:flex flex-col items-center justify-center p-0 overflow-hidden">
      <img
        src="/images/rocket-moon.png"
        alt="Rocket to the Moon"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <div class="absolute inset-0 bg-gradient-to-r from-transparent to-background/80"></div>
      <div class="relative z-10 text-center px-12">
        <h2 class="font-heading text-4xl xl:text-5xl font-bold text-white drop-shadow-lg leading-tight">
          赛托邦Cytopia
        </h2>
        <p class="text-lg text-white/70 mt-3 font-heading">
          AI工分协作平台
        </p>
      </div>
    </div>

    <!-- Right: Login Form -->
    <div class="relative z-10 flex items-center justify-center p-6 sm:p-8 lg:p-12">
      <div class="w-full max-w-sm">
        <!-- Mobile brand (lg hidden) -->
        <div class="text-center mb-8 lg:hidden">
          <h1 class="font-heading text-2xl font-bold text-foreground">赛托邦Cytopia</h1>
          <p class="text-sm text-muted-foreground mt-1">AI工分协作平台</p>
        </div>

        <!-- Desktop subtitle -->
        <div class="hidden lg:block mb-8">
          <h1 class="font-heading text-2xl font-bold text-foreground">欢迎回来</h1>
          <p class="text-sm text-muted-foreground mt-1">登录您的账号</p>
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

          <!-- Feishu Login -->
          <template v-if="feishuEnabled">
            <div class="flex items-center gap-3 mt-5">
              <div class="flex-1 h-px bg-border" />
              <span class="text-xs text-muted-foreground shrink-0">或</span>
              <div class="flex-1 h-px bg-border" />
            </div>
            <button
              type="button"
              class="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer"
              @click="loginWithFeishu"
            >
              飞书登录
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
