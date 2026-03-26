<template>
  <div class="flex h-screen bg-background">
    <!-- Left sidebar -->
    <aside class="w-64 border-r border-border flex flex-col">
      <div class="p-4 border-b border-border">
        <h1 class="text-lg font-bold text-foreground">工分平台</h1>
      </div>
      <nav class="flex-1 p-4 space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          :class="{ 'bg-accent text-accent-foreground': $route.path.startsWith(item.path) }"
        >
          <span>{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="p-4 border-t border-border">
        <button
          class="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
          @click="handleLogout"
        >
          退出登录
        </button>
      </div>
    </aside>

    <!-- Main content area -->
    <main class="flex-1 overflow-auto">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const isAdminRole = computed(() => {
  const role = authStore.user?.role;
  return role === 'hr_admin' || role === 'super_admin';
});

const navItems = computed(() => {
  const items = [
    { path: '/dashboard', label: '工作台', icon: '🏠' },
    { path: '/projects', label: '我的项目', icon: '📁' },
    { path: '/vote', label: '投票会议', icon: '🗳️' },
    { path: '/profile', label: '个人中心', icon: '👤' },
    { path: '/notifications', label: '消息通知', icon: '🔔' },
  ];
  if (isAdminRole.value) {
    items.push({ path: '/admin/hr', label: '管理后台', icon: '⚙️' });
  }
  return items;
});

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>
