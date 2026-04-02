<script setup lang="ts">
import FeishuConfigTab from '@/pages/admin/tabs/FeishuConfigTab.vue';
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-heading font-bold text-foreground">飞书集成</h1>
      <p class="text-sm text-muted-foreground mt-0.5">配置飞书开放平台集成、通讯录同步与角色映射</p>
    </div>
    <FeishuConfigTab />
  </div>
</template>
