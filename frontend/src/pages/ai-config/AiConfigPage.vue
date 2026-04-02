<script setup lang="ts">
import AiConfigTab from '@/pages/admin/tabs/AiConfigTab.vue';
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-heading font-bold text-foreground">AI 配置</h1>
      <p class="text-sm text-muted-foreground mt-0.5">管理 AI 服务源、API Key 轮询池与 Open API 密钥</p>
    </div>
    <AiConfigTab />
  </div>
</template>
