<script setup lang="ts">
import { ref, reactive } from 'vue';
import type { Task } from '@/services/task';
import { submissionApi } from '@/services/task';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps<{
  task: Task;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submitted: [];
}>();

const form = reactive({
  type: 'manual' as 'explore' | 'ai-exec' | 'manual',
  content: '',
});
const loading = ref(false);
const error = ref('');

async function handleSubmit() {
  if (!form.content.trim()) { error.value = '请填写工作描述'; return; }
  loading.value = true;
  error.value = '';
  try {
    await submissionApi.create({
      taskId: props.task.id,
      type: form.type,
      content: form.content,
    });
    emit('submitted');
    emit('close');
    form.content = '';
  } catch (err: unknown) {
    const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
    error.value = data?.message ?? '提交失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="glass-card border border-border rounded-xl w-full max-w-lg shadow-xl" @click.stop>
        <div class="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 class="font-semibold text-foreground">提交工作成果</h3>
          <button class="text-muted-foreground hover:text-foreground" @click="emit('close')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="px-6 py-4 space-y-4">
          <div>
            <p class="text-sm text-muted-foreground mb-1">任务：</p>
            <p class="font-medium text-foreground">{{ task.title }}</p>
          </div>

          <div v-if="error" class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
            {{ error }}
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">提交类型</label>
            <div class="flex gap-2">
              <button
                v-for="opt in [{ value: 'manual', label: '人工类' }, { value: 'explore', label: 'Skill/文档' }, { value: 'ai-exec', label: 'AI辅助' }]"
                :key="opt.value"
                type="button"
                class="px-3 py-1.5 text-xs rounded-md border transition-colors"
                :class="form.type === opt.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'"
                @click="form.type = opt.value as typeof form.type"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">工作描述 <span class="text-destructive">*</span></label>
            <textarea
              v-model="form.content"
              rows="5"
              placeholder="详细描述您的工作成果、完成情况、方法等..."
              class="w-full px-3 py-2 rounded-md border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
              @input="error = ''"
            />
          </div>
        </div>

        <div class="flex gap-3 px-6 py-4 border-t border-border">
          <BaseButton variant="outline" class="flex-1" @click="emit('close')">取消</BaseButton>
          <BaseButton class="flex-1" :loading="loading" @click="handleSubmit">提交</BaseButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
