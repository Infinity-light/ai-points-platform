# Sprint Contract: T5 — ColumnManagerPanel + TaskDataGrid 集成自定义列

## 任务范围

**规划对应**：T15 + T16

## 交付物

### 1. 新建文件 `frontend/src/components/ColumnManagerPanel.vue`

侧边抽屉面板，管理项目自定义列。

**Props**：
```ts
props: {
  projectId: string;
  open: boolean;           // 控制显隐
  isProjectLead: boolean;  // 仅 lead 可编辑，其余只读
}
```

**Emits**：
```ts
emits: {
  'update:open': (val: boolean) => void;
  'fields-updated': (fields: FieldDef[]) => void;
}
```

**功能**：
- 挂载时 `GET /projects/:id/custom-fields` 加载现有字段
- 展示固定列列表（不可操作，只读，标注"系统列"）
- 展示自定义列列表，每项显示：名称、类型 badge、排序号；可删除（X 按钮）
- 「添加列」按钮展开一个内联表单：
  - 列名 input（`@IsNotEmpty` 前端校验）
  - 类型 select（text/number/date/single_select/multi_select）
  - 选项 input（仅 single_select/multi_select 时显示，逗号分隔）
  - 确认/取消按钮
- key 自动生成：`cf_${Date.now()}` 确保唯一
- order 自动按当前列表长度自增
- 保存调用 `PUT /projects/:id/custom-fields`，成功后 emit `fields-updated`
- 保存中显示 loading，失败 toast 提示
- 无自定义列时显示"暂无自定义列"空状态

**新建前端 service** `frontend/src/services/custom-fields.ts`：
```ts
export const customFieldsApi = {
  get: (projectId: string) => api.get<FieldDef[]>(`/projects/${projectId}/custom-fields`),
  update: (projectId: string, fields: FieldDef[]) =>
    api.put<FieldDef[]>(`/projects/${projectId}/custom-fields`, { fields }),
};
```

以及 `FieldDef` 类型定义（与后端一致）。

### 2. 更新 `frontend/src/components/TaskDataGrid.vue`

集成自定义列到表格中。

**改动**：
- `customColumns` prop 已预留，激活后根据 `FieldDef.type` 动态生成 VxeTable 列
- 编辑器映射：
  - `text` → `input`
  - `number` → `input`（type=number）
  - `date` → `input`（type=date）
  - `single_select` → `select`（options 来自 col.options）
  - `multi_select` → 只读显示（多选暂不做行内编辑器，显示逗号分隔值）
- `onEditClosed` 中已有 `field.startsWith('metadata.')` 分支处理自定义字段保存

## 验收标准

1. `pnpm --filter frontend run build` 编译通过，无 TypeScript 错误
2. `ColumnManagerPanel.vue` 文件存在
3. props（projectId/open/isProjectLead）和 emits（update:open/fields-updated）均有定义
4. 挂载时调用 `GET /projects/:id/custom-fields`
5. 「添加列」表单：名称/类型/选项字段均有
6. 保存时调用 `PUT /projects/:id/custom-fields`，成功后 emit `fields-updated`
7. `custom-fields.ts` service 文件存在，含 `get` 和 `update` 方法
8. `TaskDataGrid.vue` 的 `customColumns` prop 动态生成列（build 通过即验证）

## 不在此任务范围内

- 替换 ProjectDetailPage（T6 的工作）
- 拖拽排序（PRD 提到但属于 nice-to-have，不做）
