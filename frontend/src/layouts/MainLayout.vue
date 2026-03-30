<template>
  <div class="relative flex h-screen">
    <SpaceBackground />

    <!-- Sidebar -->
    <aside class="glass-sidebar relative z-10 w-64 flex flex-col">
      <!-- Brand -->
      <div class="px-5 py-5 border-b border-border/50">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Rocket class="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 class="font-heading text-base font-semibold text-foreground tracking-tight">赛托邦</h1>
            <p class="text-[11px] text-muted-foreground tracking-wider uppercase">Cytopia</p>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 cursor-pointer"
          :class="isActive(item.path)
            ? 'bg-primary/10 text-primary border-l-2 border-primary -ml-px'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'"
        >
          <component :is="item.icon" class="w-[18px] h-[18px] shrink-0" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- User & Logout -->
      <div class="px-3 py-4 border-t border-border/50">
        <div v-if="authStore.user" class="px-3 mb-3">
          <p class="text-sm font-medium text-foreground truncate">{{ authStore.user.name }}</p>
          <p class="text-xs text-muted-foreground truncate">{{ authStore.user.email }}</p>
        </div>
        <button
          class="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200 cursor-pointer"
          @click="handleLogout"
        >
          <LogOut class="w-[18px] h-[18px] shrink-0" />
          <span>退出登录</span>
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="relative z-10 flex-1 overflow-auto">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import SpaceBackground from '@/components/SpaceBackground.vue';
import {
  LayoutDashboard,
  FolderKanban,
  Vote,
  User,
  Bell,
  Settings,
  LogOut,
  Rocket,
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const isAdminRole = computed(() => {
  const role = authStore.user?.role;
  return role === 'hr_admin' || role === 'super_admin';
});

const navItems = computed(() => {
  const items = [
    { path: '/dashboard', label: '工作台', icon: LayoutDashboard },
    { path: '/projects', label: '我的项目', icon: FolderKanban },
    { path: '/vote', label: '投票会议', icon: Vote },
    { path: '/profile', label: '个人中心', icon: User },
    { path: '/notifications', label: '消息通知', icon: Bell },
  ];
  if (isAdminRole.value) {
    items.push({ path: '/admin/hr', label: '管理后台', icon: Settings });
  }
  return items;
});

function isActive(path: string) {
  return route.path.startsWith(path);
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>
