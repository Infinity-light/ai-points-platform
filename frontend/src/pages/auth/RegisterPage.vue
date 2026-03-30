<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/services/auth';
import FormField from '@/components/ui/FormField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import SpaceBackground from '@/components/SpaceBackground.vue';
import { Rocket, Mail, Eye, EyeOff, ArrowLeft } from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();

const mode = ref<'join' | 'create'>('create');
const step = ref<1 | 2>(1);
const pendingUserId = ref('');
const pendingEmail = ref('');

const form = reactive({
  tenantSlug: '',
  inviteCode: '',
  orgName: '',
  orgSlug: '',
  name: '',
  email: '',
  password: '',
  phone: '',
});

const errors = reactive({
  tenantSlug: '',
  orgName: '',
  orgSlug: '',
  name: '',
  email: '',
  password: '',
  phone: '',
  global: '',
});

const verificationCode = ref('');
const verificationError = ref('');
const resendCooldown = ref(0);
const loading = ref(false);
const showPassword = ref(false);

function clearErrors() {
  errors.tenantSlug = '';
  errors.orgName = '';
  errors.orgSlug = '';
  errors.name = '';
  errors.email = '';
  errors.password = '';
  errors.phone = '';
  errors.global = '';
}

function validateStep1(): boolean {
  clearErrors();
  if (mode.value === 'join') {
    errors.tenantSlug = form.tenantSlug.trim() ? '' : '请输入组织标识';
  } else {
    errors.orgName = form.orgName.trim() ? '' : '请输入组织名称';
    errors.orgSlug = form.orgSlug.trim()
      ? /^[a-z0-9-]+$/.test(form.orgSlug.trim()) ? '' : '只能包含小写字母、数字和连字符'
      : '请输入组织标识';
  }
  errors.name = form.name.trim() ? '' : '请输入您的姓名';
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? '' : '请输入有效的邮箱地址';
  errors.password = form.password.length >= 8 ? '' : '密码至少8位';
  errors.phone = !form.phone || /^1[3-9]\d{9}$/.test(form.phone) ? '' : '手机号格式不正确';
  const hasErrors = mode.value === 'join'
    ? !!(errors.tenantSlug || errors.name || errors.email || errors.password || errors.phone)
    : !!(errors.orgName || errors.orgSlug || errors.name || errors.email || errors.password || errors.phone);
  return !hasErrors;
}

function onOrgNameInput(val: string) {
  form.orgName = val;
  errors.orgName = '';
  if (!form.orgSlug || form.orgSlug === slugify(form.orgName.slice(0, -1))) {
    form.orgSlug = slugify(val);
  }
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/[\u4e00-\u9fff]+/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

async function handleRegister() {
  if (!validateStep1() || loading.value) return;
  loading.value = true;
  try {
    let res;
    if (mode.value === 'create') {
      res = await authApi.registerOrg({
        orgName: form.orgName.trim(),
        orgSlug: form.orgSlug.trim(),
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        ...(form.phone && { phone: form.phone }),
      });
    } else {
      res = await authApi.register({
        tenantSlug: form.tenantSlug.trim(),
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        ...(form.phone && { phone: form.phone }),
        ...(form.inviteCode && { inviteCode: form.inviteCode.trim() }),
      });
    }
    pendingUserId.value = res.data.userId;
    pendingEmail.value = form.email;
    step.value = 2;
    startResendCooldown();
  } catch (err: unknown) {
    const data = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data;
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    errors.global = msg ?? '注册失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

async function handleVerify() {
  if (loading.value) return;
  verificationError.value = '';
  if (verificationCode.value.length !== 6) {
    verificationError.value = '请输入6位验证码';
    return;
  }
  loading.value = true;
  try {
    const res = await authApi.verifyEmail(pendingUserId.value, verificationCode.value);
    authStore.setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
    await router.push('/dashboard');
  } catch (err: unknown) {
    const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
    verificationError.value = data?.message ?? '验证码错误，请重试';
  } finally {
    loading.value = false;
  }
}

async function handleResend() {
  if (resendCooldown.value > 0 || loading.value) return;
  loading.value = true;
  verificationError.value = '';
  try {
    await authApi.resendVerification(pendingUserId.value);
    startResendCooldown();
  } catch {
    verificationError.value = '发送失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

function startResendCooldown() {
  resendCooldown.value = 60;
  const timer = setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) clearInterval(timer);
  }, 1000);
}

function onCodeInput(val: string) {
  verificationCode.value = val.replace(/\D/g, '').slice(0, 6);
  if (verificationCode.value.length === 6) handleVerify();
}

function switchMode(newMode: 'join' | 'create') {
  mode.value = newMode;
  clearErrors();
}
</script>

<template>
  <div class="relative min-h-screen grid grid-cols-1 lg:grid-cols-2">
    <SpaceBackground />

    <!-- Left: Brand Panel -->
    <div class="relative z-10 hidden lg:flex flex-col justify-between p-12 xl:p-16">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Rocket class="w-5 h-5 text-primary" />
        </div>
        <div>
          <span class="font-heading text-lg font-semibold text-foreground">赛托邦</span>
          <span class="text-xs text-muted-foreground tracking-wider ml-2 uppercase">Cytopia</span>
        </div>
      </div>

      <div class="flex-1 flex flex-col justify-center max-w-lg">
        <h2 class="font-heading text-4xl xl:text-5xl font-bold text-foreground leading-tight mb-6">
          让每一颗创新的种子<br/>
          <span class="text-lunar">生根发芽</span>
        </h2>
        <p class="text-lg text-muted-foreground leading-relaxed">
          向赛博时代的乌托邦砥砺前行
        </p>
      </div>

      <div class="text-xs text-muted-foreground">
        &copy; {{ new Date().getFullYear() }} Cytopia. All rights reserved.
      </div>
    </div>

    <!-- Right: Register Form -->
    <div class="relative z-10 flex items-center justify-center p-6 sm:p-8 lg:p-12">
      <div class="w-full max-w-sm">
        <!-- Mobile brand -->
        <div class="text-center mb-6 lg:hidden">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 mb-4">
            <Rocket class="w-6 h-6 text-primary" />
          </div>
          <h1 class="font-heading text-2xl font-bold text-foreground">赛托邦 Cytopia</h1>
        </div>

        <!-- Desktop subtitle -->
        <div class="hidden lg:block mb-6">
          <h1 class="font-heading text-2xl font-bold text-foreground">
            {{ step === 1 ? '创建账号' : '验证邮箱' }}
          </h1>
          <p class="text-sm text-muted-foreground mt-1">
            {{ step === 1 ? '加入赛托邦，开启协作之旅' : '请查收验证邮件' }}
          </p>
        </div>

        <!-- Progress -->
        <div class="flex items-center mb-6 gap-2">
          <div class="flex-1 h-1 rounded-full transition-colors duration-300"
            :class="step >= 1 ? 'bg-primary' : 'bg-border'" />
          <div class="flex-1 h-1 rounded-full transition-colors duration-300"
            :class="step >= 2 ? 'bg-primary' : 'bg-border'" />
        </div>

        <!-- Form Card -->
        <div class="glass-card p-8">
          <!-- Step 1 -->
          <form v-if="step === 1" @submit.prevent="handleRegister" class="space-y-4" novalidate>
            <div v-if="errors.global"
              class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-md">
              {{ errors.global }}
            </div>

            <!-- Mode toggle -->
            <div class="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                class="flex-1 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                :class="mode === 'create'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'"
                @click="switchMode('create')"
              >
                创建新组织
              </button>
              <button
                type="button"
                class="flex-1 py-2.5 text-sm font-medium transition-colors border-l border-border cursor-pointer"
                :class="mode === 'join'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'"
                @click="switchMode('join')"
              >
                加入现有组织
              </button>
            </div>

            <!-- Create org fields -->
            <template v-if="mode === 'create'">
              <FormField label="组织名称" :error="errors.orgName" required hint="您的团队或公司名称">
                <BaseInput
                  :model-value="form.orgName"
                  placeholder="例如：神笔科技"
                  :error="!!errors.orgName"
                  autocomplete="organization"
                  @update:model-value="onOrgNameInput"
                />
              </FormField>
              <FormField label="组织标识" :error="errors.orgSlug" required hint="用于登录的唯一标识">
                <BaseInput
                  v-model="form.orgSlug"
                  placeholder="例如：shenbi-tech"
                  :error="!!errors.orgSlug"
                  @input="errors.orgSlug = ''"
                />
              </FormField>
            </template>

            <template v-else>
              <FormField label="组织标识" :error="errors.tenantSlug" required hint="由管理员提供的团队标识">
                <BaseInput
                  v-model="form.tenantSlug"
                  placeholder="例如：shenbi-team"
                  :error="!!errors.tenantSlug"
                  autocomplete="organization"
                  @input="errors.tenantSlug = ''"
                />
              </FormField>
            </template>

            <FormField label="姓名" :error="errors.name" required>
              <BaseInput v-model="form.name" placeholder="您的真实姓名" :error="!!errors.name" autocomplete="name" @input="errors.name = ''" />
            </FormField>

            <FormField label="邮箱" :error="errors.email" required>
              <BaseInput v-model="form.email" type="email" placeholder="your@email.com" :error="!!errors.email" autocomplete="email" @input="errors.email = ''" />
            </FormField>

            <FormField label="密码" :error="errors.password" required hint="至少8位">
              <div class="relative">
                <BaseInput
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="请设置密码"
                  :error="!!errors.password"
                  autocomplete="new-password"
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

            <FormField label="手机号" :error="errors.phone" hint="选填">
              <BaseInput v-model="form.phone" type="tel" placeholder="11位手机号" :error="!!errors.phone" autocomplete="tel" @input="errors.phone = ''" />
            </FormField>

            <FormField v-if="mode === 'join'" label="邀请码" hint="选填，由管理员提供">
              <BaseInput v-model="form.inviteCode" placeholder="8位邀请码" autocomplete="off" />
            </FormField>

            <BaseButton type="submit" class="w-full" size="lg" :loading="loading">
              {{ mode === 'create' ? '创建组织并注册' : '注册' }}
            </BaseButton>

            <p v-if="mode === 'create'" class="text-xs text-muted-foreground text-center">
              创建者将自动成为组织超级管理员
            </p>
          </form>

          <!-- Step 2: Email Verification -->
          <div v-else class="space-y-6 text-center">
            <div>
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Mail class="w-8 h-8 text-primary" />
              </div>
              <h3 class="text-lg font-heading font-semibold text-foreground">验证您的邮箱</h3>
              <p class="text-sm text-muted-foreground mt-1">
                我们已向 <span class="font-medium text-foreground">{{ pendingEmail }}</span> 发送了6位验证码
              </p>
            </div>

            <div class="space-y-3">
              <div v-if="verificationError"
                class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-md text-left">
                {{ verificationError }}
              </div>

              <input
                :value="verificationCode"
                type="text"
                inputmode="numeric"
                maxlength="6"
                placeholder="000000"
                class="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-4 rounded-md border bg-secondary/50 text-primary placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                :class="verificationError ? 'border-destructive' : 'border-border'"
                @input="onCodeInput(($event.target as HTMLInputElement).value)"
              />

              <BaseButton class="w-full" size="lg" :loading="loading" @click="handleVerify">
                验证邮箱
              </BaseButton>
            </div>

            <div class="text-sm text-muted-foreground">
              没有收到验证码？
              <button
                v-if="resendCooldown === 0"
                class="text-primary font-medium hover:underline disabled:opacity-50 cursor-pointer"
                :disabled="loading"
                @click="handleResend"
              >
                重新发送
              </button>
              <span v-else class="text-muted-foreground">{{ resendCooldown }}秒后可重发</span>
            </div>

            <button
              class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              @click="step = 1"
            >
              <ArrowLeft class="w-3 h-3" />
              修改注册信息
            </button>
          </div>
        </div>

        <p v-if="step === 1" class="text-center text-sm text-muted-foreground mt-6">
          已有账号？
          <router-link to="/login" class="text-primary font-medium hover:underline">
            立即登录
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
