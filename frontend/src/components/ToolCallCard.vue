<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDown, ChevronRight, Wrench, Check, X, Loader2 } from 'lucide-vue-next';

const props = defineProps<{
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'done' | 'error';
  error?: string;
}>();

const expanded = ref(false);

function toggle() {
  expanded.value = !expanded.value;
}

function formatJson(val: unknown): string {
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}
</script>

<template>
  <div
    class="glass-card mt-2 overflow-hidden text-xs cursor-pointer select-none"
    @click="toggle"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-2">
      <component
        :is="expanded ? ChevronDown : ChevronRight"
        class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"
      />
      <Wrench class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span class="font-mono text-foreground font-medium truncate">{{ toolName }}</span>
      <span class="ml-auto flex-shrink-0">
        <Loader2
          v-if="status === 'pending'"
          class="w-3.5 h-3.5 text-primary animate-spin"
        />
        <Check v-else-if="status === 'done'" class="w-3.5 h-3.5 text-green-400" />
        <X v-else class="w-3.5 h-3.5 text-red-400" />
      </span>
    </div>

    <!-- Expanded content -->
    <div v-if="expanded" class="border-t border-border/50 px-3 py-2 space-y-2" @click.stop>
      <div>
        <p class="text-muted-foreground mb-1 font-medium">输入</p>
        <pre class="bg-black/20 rounded p-2 overflow-x-auto text-[11px] leading-relaxed text-foreground/80">{{ formatJson(input) }}</pre>
      </div>
      <div v-if="status === 'done' && result !== undefined">
        <p class="text-muted-foreground mb-1 font-medium">��回</p>
        <pre class="bg-black/20 rounded p-2 overflow-x-auto text-[11px] leading-relaxed text-foreground/80 max-h-64 overflow-y-auto">{{ formatJson(result) }}</pre>
      </div>
      <div v-if="status === 'error' && error">
        <p class="text-red-400 mb-1 font-medium">错误</p>
        <pre class="bg-red-500/10 rounded p-2 text-[11px] text-red-300">{{ error }}</pre>
      </div>
    </div>
  </div>
</template>
