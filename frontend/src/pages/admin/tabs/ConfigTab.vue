<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { superAdminApi, type GlobalConfig } from '@/services/super-admin';

const config = ref<GlobalConfig>({ llmModel: '', llmBaseUrl: '', maxFileSizeMb: 10 });
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref(false);

async function loadConfig() {
  loading.value = true;
  error.value = '';
  try {
    config.value = await superAdminApi.getConfig();
  } catch (e: unknown) {
    error.value = (e as Error).message ?? '加载失败';
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  saving.value = true;
  error.value = '';
  success.value = false;
  try {
    config.value = await superAdminApi.updateConfig(config.value);
    success.value = true;
    setTimeout(() => { success.value = false; }, 2000);
  } catch (e: unknown) {
    error.value = (e as Error).message ?? '保存失败';
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadConfig();
});
</script>

<template>
  <div>
    <h2 class="font-heading font-semibold text-foreground mb-4">全局配置</h2>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-12 bg-secondary rounded-lg animate-pulse" />
    </div>

    <div v-else class="glass-card p-6 max-w-lg space-y-5">
      <div>
        <label class="block text-sm font-medium text-foreground mb-1">LLM 模型名称</label>
        <input
          v-model="config.llmModel"
          type="text"
          placeholder="claude-sonnet-4-6"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-foreground mb-1">LLM API Base URL</label>
        <input
          v-model="config.llmBaseUrl"
          type="text"
          placeholder="（可选，留空使用默认）"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-foreground mb-1">最大文件大小 (MB)</label>
        <input
          v-model.number="config.maxFileSizeMb"
          type="number"
          min="1"
          max="500"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200"
        />
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <p v-if="success" class="text-sm text-green-400">保存成功</p>

      <button
        class="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200 cursor-pointer"
        :disabled="saving"
        @click="saveConfig"
      >
        {{ saving ? '保存中...' : '保存配置' }}
      </button>
    </div>
  </div>
</template>
