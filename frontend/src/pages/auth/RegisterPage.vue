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

// Step 1: registration info
const step = ref<1 | 2>(1);
const pendingUserId = ref('');
const pendingEmail = ref('');

const form = reactive({
  tenantSlug: '',
  name: '',
  email: '',
  password: '',
  phone: '',
  inviteCode: '',
});

const errors = reactive({
  tenantSlug: '',
  name: '',
  email: '',
  password: '',
  phone: '',
  global: '',
});

// Step 2: verification
const verificationCode = ref('');
const verificationError = ref('');
const resendCooldown = ref(0);

const loading = ref(false);
const showPassword = ref(false);

function validateStep1(): boolean {
  errors.tenantSlug = form.tenantSlug.trim() ? '' : '请输入组织标识';
  errors.name = form.name.trim() ? '' : '请输入您的姓名';
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? '' : '请输入有效的邮箱地址';
  errors.password = form.password.length >= 8 ? '' : '密码至少8位';
  errors.phone = !form.phone || /^1[3-9]\d{9}$/.test(form.phone) ? '' : '手机号格式不正确';
  errors.global = '';
  return !errors.tenantSlug && !errors.name && !errors.email && !errors.password && !errors.phone;
}

async function handleRegister() {
  if (!validateStep1() || loading.value) return;
  loading.value = true;
  try {
    const payload = {
      tenantSlug: form.tenantSlug.trim(),
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim(),
      ...(form.phone && { phone: form.phone }),
      ...(form.inviteCode && { inviteCode: form.inviteCode.trim() }),
    };
    const res = await authApi.register(payload);
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

// Handle code input — auto-submit when 6 digits entered
function onCodeInput(val: string) {
  verificationCode.value = val.replace(/\D/g, '').slice(0, 6);
  if (verificationCode.value.length === 6) handleVerify();
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="w-full max-w-md">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
          <svg class="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-foreground">注册账号</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ step === 1 ? '填写您的信息' : '验证您的邮箱' }}
        </p>
      </div>

      <!-- Progress indicator -->
      <div class="flex items-center mb-6 gap-2">
        <div class="flex-1 h-1 rounded-full transition-colors"
          :class="step >= 1 ? 'bg-primary' : 'bg-border'" />
        <div class="flex-1 h-1 rounded-full transition-colors"
          :class="step >= 2 ? 'bg-primary' : 'bg-border'" />
      </div>

      <!-- Card -->
      <div class="bg-card border border-border rounded-xl p-8 shadow-sm">

        <!-- Step 1: Registration Form -->
        <form v-if="step === 1" @submit.prevent="handleRegister" class="space-y-4" novalidate>
          <div v-if="errors.global"
            class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-md">
            {{ errors.global }}
          </div>

          <FormField label="组织标识" :error="errors.tenantSlug" required hint="您的团队 slug，由管理员提供">
            <BaseInput
              v-model="form.tenantSlug"
              placeholder="例如：shenbi-team"
              :error="!!errors.tenantSlug"
              autocomplete="organization"
              @input="errors.tenantSlug = ''"
            />
          </FormField>

          <FormField label="姓名" :error="errors.name" required>
            <BaseInput
              v-model="form.name"
              placeholder="您的真实姓名"
              :error="!!errors.name"
              autocomplete="name"
              @input="errors.name = ''"
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

          <FormField label="手机号" :error="errors.phone" hint="选填">
            <BaseInput
              v-model="form.phone"
              type="tel"
              placeholder="11位手机号"
              :error="!!errors.phone"
              autocomplete="tel"
              @input="errors.phone = ''"
            />
          </FormField>

          <FormField label="邀请码" hint="选填，由管理员提供">
            <BaseInput
              v-model="form.inviteCode"
              placeholder="8位邀请码"
              autocomplete="off"
            />
          </FormField>

          <BaseButton type="submit" class="w-full" size="lg" :loading="loading">
            注册
          </BaseButton>
        </form>

        <!-- Step 2: Email Verification -->
        <div v-else class="space-y-6 text-center">
          <div>
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-foreground">验证您的邮箱</h3>
            <p class="text-sm text-muted-foreground mt-1">
              我们已向 <span class="font-medium text-foreground">{{ pendingEmail }}</span> 发送了6位验证码
            </p>
          </div>

          <div class="space-y-3">
            <div v-if="verificationError"
              class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-md text-left">
              {{ verificationError }}
            </div>

            <!-- Code input -->
            <input
              :value="verificationCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="输入6位验证码"
              class="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-4 rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
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
              class="text-primary font-medium hover:underline disabled:opacity-50"
              :disabled="loading"
              @click="handleResend"
            >
              重新发送
            </button>
            <span v-else class="text-muted-foreground">{{ resendCooldown }}秒后可重发</span>
          </div>

          <button
            class="text-xs text-muted-foreground hover:text-foreground transition-colors"
            @click="step = 1"
          >
            ← 修改注册信息
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
</template>
