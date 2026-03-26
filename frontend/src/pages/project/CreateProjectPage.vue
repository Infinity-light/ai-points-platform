<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { projectApi } from '@/services/project';
import FormField from '@/components/ui/FormField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();
const loading = ref(false);
const globalError = ref('');

const form = reactive({
  name: '',
  description: '',
  periodType: 'weekly' as 'weekly' | 'monthly',
  dayOfWeek: 1,
  dayOfMonth: 1,
  cyclesPerStep: 3,
  maxSteps: 9,
});

const errors = reactive({ name: '', global: '' });

function validate() {
  errors.name = form.name.trim() ? '' : '请输入项目名称';
  return !errors.name;
}

async function handleSubmit() {
  if (!validate() || loading.value) return;
  loading.value = true;
  globalError.value = '';
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      annealingConfig: { cyclesPerStep: form.cyclesPerStep, maxSteps: form.maxSteps },
      settlementConfig: form.periodType === 'weekly'
        ? { periodType: 'weekly' as const, dayOfWeek: form.dayOfWeek }
        : { periodType: 'monthly' as const, dayOfMonth: form.dayOfMonth },
    };
    const res = await projectApi.create(payload);
    await router.push(`/projects/${res.data.id}`);
  } catch (err: unknown) {
    const data = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data;
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    globalError.value = msg ?? '创建失败，请重试';
  } finally {
    loading.value = false;
  }
}

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <button class="text-muted-foreground hover:text-foreground transition-colors" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h1 class="text-xl font-bold text-foreground">创建项目</h1>
        <p class="text-xs text-muted-foreground">配置项目基本信息和工分规则</p>
      </div>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6" novalidate>
      <div v-if="globalError"
        class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg">
        {{ globalError }}
      </div>

      <!-- 基本信息 -->
      <div class="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 class="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">基本信息</h2>

        <FormField label="项目名称" :error="errors.name" required>
          <BaseInput
            v-model="form.name"
            placeholder="例如：神笔 2026 Q2"
            :error="!!errors.name"
            @input="errors.name = ''"
          />
        </FormField>

        <FormField label="项目描述" hint="选填">
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="简述项目目标和背景..."
            class="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-colors"
          />
        </FormField>
      </div>

      <!-- 结算配置 -->
      <div class="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 class="font-semibold text-sm uppercase tracking-wide text-muted-foreground">结算周期</h2>

        <div class="flex gap-3">
          <label
            v-for="opt in [{ value: 'weekly', label: '每周结算' }, { value: 'monthly', label: '每月结算' }]"
            :key="opt.value"
            class="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors"
            :class="form.periodType === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'"
          >
            <input type="radio" :value="opt.value" v-model="form.periodType" class="sr-only" />
            <div
              class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
              :class="form.periodType === opt.value ? 'border-primary' : 'border-border'"
            >
              <div v-if="form.periodType === opt.value" class="w-2 h-2 rounded-full bg-primary" />
            </div>
            <span class="text-sm font-medium">{{ opt.label }}</span>
          </label>
        </div>

        <div v-if="form.periodType === 'weekly'" class="space-y-1.5">
          <label class="text-sm font-medium text-foreground">结算日</label>
          <div class="flex gap-1.5 flex-wrap">
            <button
              v-for="(day, i) in weekdays"
              :key="i"
              type="button"
              class="px-3 py-1.5 text-xs rounded-md border transition-colors"
              :class="form.dayOfWeek === i
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-accent'"
              @click="form.dayOfWeek = i"
            >
              {{ day }}
            </button>
          </div>
        </div>

        <div v-else class="space-y-1.5">
          <label class="text-sm font-medium text-foreground">每月第 <span class="text-primary font-bold">{{ form.dayOfMonth }}</span> 天</label>
          <input
            type="range"
            v-model.number="form.dayOfMonth"
            min="1" max="28"
            class="w-full accent-primary"
          />
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>1日</span><span>28日</span>
          </div>
        </div>
      </div>

      <!-- 退火配置 -->
      <div class="bg-card border border-border rounded-lg p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-sm uppercase tracking-wide text-muted-foreground">工分退火</h2>
          <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">防贡献固化</span>
        </div>

        <div class="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          每经过 <span class="font-medium text-foreground">{{ form.cyclesPerStep }}</span> 次结算，活跃工分衰减一档（×1 → ×½ → ×⅓…），
          超过 <span class="font-medium text-foreground">{{ form.maxSteps }}</span> 档后清零。
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">每档周期（次结算）</label>
            <input
              type="number"
              v-model.number="form.cyclesPerStep"
              min="1" max="12"
              class="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">最大档数</label>
            <input
              type="number"
              v-model.number="form.maxSteps"
              min="3" max="20"
              class="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <BaseButton type="button" variant="outline" class="flex-1" @click="router.back()">取消</BaseButton>
        <BaseButton type="submit" class="flex-1" :loading="loading">创建项目</BaseButton>
      </div>
    </form>
  </div>
</template>
