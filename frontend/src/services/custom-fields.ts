import api from '@/lib/axios';

export interface FieldDef {
  key: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'single_select' | 'multi_select';
  options?: string[];
  order: number;
}

export const customFieldsApi = {
  get: (projectId: string) =>
    api.get<FieldDef[]>(`/projects/${projectId}/custom-fields`),
  update: (projectId: string, fields: FieldDef[]) =>
    api.put<FieldDef[]>(`/projects/${projectId}/custom-fields`, { fields }),
};
