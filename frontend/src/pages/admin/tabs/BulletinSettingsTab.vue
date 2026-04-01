<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '@/lib/axios';
import { Eye, EyeOff, Save } from 'lucide-vue-next';

interface BulletinSettings {
  bulletinPublic: boolean;
}

const settings = ref<BulletinSettings>({ bulletinPublic: false });
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const saved = ref(false);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get<{ settings: Record<string, unknown> }>('/admin/tenant-settings');
    settings.value = {
      bulletinPublic: Boolean((res.data.settings as Record<string, unknown>)?.bulletinPublic ?? false),
    };
  } catch (e) {
    error.value = '加载设置失败';
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = '';
  saved.value = false;
  try {
    await api.patch('/admin/tenant-settings', { bulletinPublic: settings.value.bulletinPublic });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  } catch (e) {
    error.value = '保存失败，请重试';
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <h2 class="text-base font-semibold text-foreground mb-1">公示区设置</h2>
    <p class="text-sm text-muted-foreground mb-6">控制公示区内容是否向外部公开（无需登录可访问）</p>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="h-14 bg-secondary rounded-lg animate-pulse" />
    </div>

    <template v-else>
      <!-- 公开开关 -->
      <div class="glass-card p-5 mb-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <component
              :is="settings.bulletinPublic ? Eye : EyeOff"
              class="w-5 h-5"
              :class="settings.bulletinPublic ? 'text-primary' : 'text-muted-foreground'"
            />
            <div>
              <p class="text-sm font-medium text-foreground">公开公示区</p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ settings.bulletinPublic ? '已开启 — 外部用户可通过 /public/:tenantSlug/bulletin/ 访问' : '已关闭 — 仅登录用户可查看' }}
              </p>
            </div>
          </div>
          <!-- 开关 -->
          <button
            class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
            :class="settings.bulletinPublic ? 'bg-primary' : 'bg-muted-foreground/30'"
            @click="settings.bulletinPublic = !settings.bulletinPublic"
          >
            <span
              class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
              :class="settings.bulletinPublic ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>
      </div>

      <p v-if="error" class="text-sm text-destructive mb-3">{{ error }}</p>
      <p v-if="saved" class="text-sm text-green-400 mb-3">保存成功</p>

      <button
        class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        :disabled="saving"
        @click="save"
      >
        <Save class="w-4 h-4" />
        {{ saving ? '保存中...' : '保存设置' }}
      </button>
    </template>
  </div>
</template>
