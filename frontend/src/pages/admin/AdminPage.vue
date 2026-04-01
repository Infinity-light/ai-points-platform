<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import { usePermissionStore } from '@/stores/permission';

interface TabDef {
  key: string;
  label: string;
  permission: { resource: string; action: string } | null;
  component: ReturnType<typeof defineAsyncComponent>;
}

const permissionStore = usePermissionStore();

const allTabs: TabDef[] = [
  {
    key: 'users',
    label: '用户管理',
    permission: { resource: 'users', action: 'read' },
    component: defineAsyncComponent(() => import('./tabs/UserManagementTab.vue')),
  },
  {
    key: 'roles',
    label: '权限矩阵',
    permission: { resource: 'roles', action: 'read' },
    component: defineAsyncComponent(() => import('./tabs/RolePermissionTab.vue')),
  },
  {
    key: 'invites',
    label: '邀请码管理',
    permission: { resource: 'users', action: 'read' },
    component: defineAsyncComponent(() => import('./tabs/InviteTab.vue')),
  },
  {
    key: 'approvals',
    label: '工分审批',
    permission: { resource: 'points', action: 'approve' },
    component: defineAsyncComponent(() => import('./tabs/ApprovalTab.vue')),
  },
  {
    key: 'tenants',
    label: '租户管理',
    permission: { resource: 'tenants', action: 'read' },
    component: defineAsyncComponent(() => import('./tabs/TenantTab.vue')),
  },
  {
    key: 'config',
    label: '全局配置',
    permission: { resource: 'config', action: 'read' },
    component: defineAsyncComponent(() => import('./tabs/ConfigTab.vue')),
  },
  {
    key: 'stats',
    label: '运营数据',
    permission: { resource: 'config', action: 'read' },
    component: defineAsyncComponent(() => import('./tabs/StatsTab.vue')),
  },
  {
    key: 'bulletin-settings',
    label: '公示区设置',
    permission: { resource: 'config', action: 'update' },
    component: defineAsyncComponent(() => import('./tabs/BulletinSettingsTab.vue')),
  },
  {
    key: 'audit-log',
    label: '审计日志',
    permission: { resource: 'audit', action: 'read' },
    component: defineAsyncComponent(() => import('./tabs/AuditLogTab.vue')),
  },
];

const visibleTabs = computed(() => {
  return allTabs.filter((tab) => {
    if (!tab.permission) return true;
    return permissionStore.can(tab.permission.action, tab.permission.resource);
  });
});

const activeTabKey = ref<string>('');

const activeTab = computed(() => {
  if (!activeTabKey.value && visibleTabs.value.length > 0) {
    return visibleTabs.value[0];
  }
  return visibleTabs.value.find((t) => t.key === activeTabKey.value) ?? visibleTabs.value[0];
});

function switchTab(key: string) {
  activeTabKey.value = key;
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <!-- 标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-heading font-bold text-foreground">管理后台</h1>
      <p class="text-sm text-muted-foreground mt-0.5">统一管理控制台</p>
    </div>

    <!-- 无权限 -->
    <div
      v-if="visibleTabs.length === 0"
      class="text-center py-16 text-muted-foreground text-sm"
    >
      您没有访问管理后台的权限
    </div>

    <template v-else>
      <!-- Tab 栏 -->
      <div class="border-b border-border mb-6">
        <nav class="flex gap-1 overflow-x-auto">
          <button
            v-for="tab in visibleTabs"
            :key="tab.key"
            class="px-4 pb-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px whitespace-nowrap cursor-pointer"
            :class="
              activeTab?.key === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            "
            @click="switchTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- Tab 内容 -->
      <Suspense>
        <component :is="activeTab?.component" v-if="activeTab" />
        <template #fallback>
          <div class="space-y-3 mt-4">
            <div v-for="i in 5" :key="i" class="h-12 bg-secondary rounded-lg animate-pulse" />
          </div>
        </template>
      </Suspense>
    </template>
  </div>
</template>
