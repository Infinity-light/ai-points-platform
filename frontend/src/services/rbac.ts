import api from '@/lib/axios';

export interface Permission {
  resource: string;
  action: string;
}

export interface RoleDto {
  id: string;
  tenantId: string | null;
  name: string;
  description: string | null;
  scope: 'tenant' | 'project';
  isSystem: boolean;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProjectInfo {
  projectId: string;
  projectName: string;
  projectStatus: string;
  projectRoleId: string;
  projectRoleName: string | null;
  joinedAt: string;
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  scope: 'tenant' | 'project';
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
}

export const rbacApi = {
  listRoles: (scope?: string): Promise<RoleDto[]> => {
    const params = scope ? { scope } : {};
    return api.get<RoleDto[]>('/rbac/roles', { params }).then((r) => r.data);
  },

  createRole: (payload: CreateRolePayload): Promise<RoleDto> =>
    api.post<RoleDto>('/rbac/roles', payload).then((r) => r.data),

  updateRole: (id: string, payload: UpdateRolePayload): Promise<RoleDto> =>
    api.patch<RoleDto>(`/rbac/roles/${id}`, payload).then((r) => r.data),

  deleteRole: (id: string): Promise<void> =>
    api.delete(`/rbac/roles/${id}`).then(() => undefined),

  getPermissions: (roleId: string): Promise<Permission[]> =>
    api.get<Permission[]>(`/rbac/roles/${roleId}/permissions`).then((r) => r.data),

  setPermissions: (roleId: string, permissions: Permission[]): Promise<Permission[]> =>
    api.put<Permission[]>(`/rbac/roles/${roleId}/permissions`, { permissions }).then((r) => r.data),

  assignTenantRole: (userId: string, roleId: string): Promise<unknown> =>
    api.patch(`/rbac/users/${userId}/tenant-role`, { roleId }).then((r) => r.data),

  assignProjectRole: (userId: string, projectId: string, roleId: string): Promise<unknown> =>
    api
      .patch(`/rbac/users/${userId}/project-role`, { projectId, roleId })
      .then((r) => r.data),

  getMyPermissions: (): Promise<Permission[]> =>
    api.get<Permission[]>('/rbac/my-permissions').then((r) => r.data),
};
