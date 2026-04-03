<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { brainPluginApi, type BrainPluginInfo } from '@/services/brain';
import { ChevronDown, ChevronRight, Wrench, Power } from 'lucide-vue-next';

const plugins = ref<BrainPluginInfo[]>([]);
const loading = ref(true);
const error = ref('');
const expandedIds = ref<Set<string>>(new Set());
const saving = ref<Set<string>>(new Set());

async function load() {
  loading.value = true;
  error.value = '';
  try {
    plugins.value = await brainPluginApi.list();
  } catch {
    error.value = '加载插件列表失败';
  } finally {
    loading.value = false;
  }
}

function toggle(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
}

async function toggleEnabled(plugin: BrainPluginInfo) {
  saving.value.add(plugin.id);
  try {
    await brainPluginApi.update(plugin.id, { enabled: !plugin.enabled });
    plugin.enabled = !plugin.enabled;
  } catch {
    // revert visual state handled by not changing
  } finally {
    saving.value.delete(plugin.id);
  }
}

const typeLabels: Record<string, string> = {
  builtin: '内置',
  mcp: 'MCP',
  cli: 'CLI',
  custom: '自定义',
};

const typeColors: Record<string, string> = {
  builtin: 'bg-primary/10 text-primary',
  mcp: 'bg-blue-500/10 text-blue-400',
  cli: 'bg-amber-500/10 text-amber-400',
  custom: 'bg-purple-500/10 text-purple-400',
};

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-heading font-semibold text-foreground">智脑插件</h3>
      <p class="text-sm text-muted-foreground">管理智脑可用的工具插件</p>
    </div>

    <div v-if="loading" class="text-center py-12 text-muted-foreground">加载中...</div>

    <div v-else-if="error" class="text-center py-12 text-red-400">{{ error }}</div>

    <div v-else class="space-y-3">
      <div
        v-for="plugin in plugins"
        :key="plugin.id"
        class="glass-card overflow-hidden"
      >
        <!-- Plugin header -->
        <div class="flex items-center gap-3 px-4 py-3">
          <button @click="toggle(plugin.id)" class="flex-shrink-0 cursor-pointer">
            <component
              :is="expandedIds.has(plugin.id) ? ChevronDown : ChevronRight"
              class="w-4 h-4 text-muted-foreground"
            />
          </button>

          <Wrench class="w-4 h-4 text-muted-foreground flex-shrink-0" />

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-foreground">{{ plugin.name }}</span>
              <span
                :class="['px-1.5 py-0.5 rounded text-[10px] font-mono font-medium', typeColors[plugin.type] || typeColors.custom]"
              >
                {{ typeLabels[plugin.type] || plugin.type }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              {{ plugin.toolCount }} 个工具
              <span class="ml-2 font-mono text-[10px] opacity-60">{{ plugin.id }}</span>
            </p>
          </div>

          <button
            @click="toggleEnabled(plugin)"
            :disabled="saving.has(plugin.id)"
            :class="[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
              plugin.enabled
                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
            ]"
          >
            <Power class="w-3.5 h-3.5" />
            {{ plugin.enabled ? '已启用' : '已禁用' }}
          </button>
        </div>

        <!-- Expanded: tools list -->
        <div v-if="expandedIds.has(plugin.id)" class="border-t border-border/50 px-4 py-3">
          <p class="text-xs font-medium text-muted-foreground mb-2">工具列表</p>
          <div class="space-y-1.5">
            <div
              v-for="tool in plugin.tools"
              :key="tool.name"
              class="flex items-start gap-2 text-xs bg-secondary/30 rounded-lg px-3 py-2"
            >
              <span class="font-mono text-primary font-medium whitespace-nowrap mt-0.5">{{ tool.name }}</span>
              <span class="text-muted-foreground">{{ tool.description }}</span>
              <span
                v-if="tool.requiredPermission"
                class="ml-auto flex-shrink-0 text-[10px] font-mono text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded"
              >
                {{ tool.requiredPermission.resource }}:{{ tool.requiredPermission.action }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
