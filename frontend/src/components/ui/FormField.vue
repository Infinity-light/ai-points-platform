<script setup lang="ts">
defineProps<{
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}>();
</script>

<template>
  <div class="space-y-1.5">
    <label class="block text-sm font-medium text-foreground">
      {{ label }}<span v-if="required" class="text-destructive ml-0.5">*</span>
    </label>
    <slot />
    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-muted-foreground">{{ hint }}</p>
  </div>
</template>
