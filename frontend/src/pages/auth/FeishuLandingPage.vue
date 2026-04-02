<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

onMounted(() => {
  const accessToken = route.query.token as string | undefined;
  const refreshToken = route.query.refresh_token as string | undefined;
  if (accessToken) localStorage.setItem('access_token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
  void router.replace('/dashboard');
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
    正在跳转...
  </div>
</template>
