import { usePermissionStore } from '@/stores/permission';

export function useAbility() {
  const permissionStore = usePermissionStore();

  function can(action: string, resource: string): boolean {
    return permissionStore.can(action, resource);
  }

  function canAny(checks: Array<{ action: string; resource: string }>): boolean {
    return checks.some(({ action, resource }) => can(action, resource));
  }

  function canAll(checks: Array<{ action: string; resource: string }>): boolean {
    return checks.every(({ action, resource }) => can(action, resource));
  }

  return { can, canAny, canAll };
}
