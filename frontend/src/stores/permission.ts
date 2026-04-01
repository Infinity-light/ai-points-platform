import { defineStore } from 'pinia';
import { ref } from 'vue';
import { rbacApi, type Permission } from '@/services/rbac';

export const usePermissionStore = defineStore('permission', () => {
  const permissions = ref<Permission[]>([]);
  const loaded = ref(false);

  async function fetchPermissions(): Promise<void> {
    try {
      permissions.value = await rbacApi.getMyPermissions();
      loaded.value = true;
    } catch {
      permissions.value = [];
      loaded.value = true;
    }
  }

  function can(action: string, resource: string): boolean {
    return permissions.value.some(
      (p) => p.resource === resource && p.action === action,
    );
  }

  function reset(): void {
    permissions.value = [];
    loaded.value = false;
  }

  return { permissions, loaded, fetchPermissions, can, reset };
});
