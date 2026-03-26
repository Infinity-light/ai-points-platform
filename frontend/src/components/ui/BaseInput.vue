<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  modelValue: string;
  type?: string;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  autocomplete?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const baseClass = computed(() =>
  cn(
    'w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground',
    'placeholder:text-muted-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'transition-colors',
    props.error
      ? 'border-destructive focus:ring-destructive/30'
      : 'border-border',
  ),
);
</script>

<template>
  <input
    :class="baseClass"
    :type="type ?? 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :autocomplete="autocomplete"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
