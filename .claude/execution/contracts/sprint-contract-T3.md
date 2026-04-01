# Sprint Contract: T3 — TaskDataGrid 组件（基础表格 + 行内编辑 + 新建行）

## 任务范围

**规划对应**：T11 + T12 + T13

## 交付物

### 新建文件

#### `frontend/src/components/TaskDataGrid.vue`

完整的 VxeTable 多维表格组件，包含：

**Props**：
```ts
props: {
  tasks: Task[]          // 任务列表
  loading: boolean       // 加载状态
  projectId: string      // 项目 ID（用于 API 调用）
  members: Member[]      // 项目成员列表（显示负责人名称）
}
```

**Emits**：
```ts
emits: {
  'update:task': (task: Task) => void   // 行内编辑保存后
  'create:task': (task: Task) => void   // 新任务创建后
  'select:task': (task: Task) => void   // 点击行时
}
```

**固定列定义**（按顺序）：

| 列 | field | 宽度 | 可编辑 | 编辑器 | 备注 |
|---|---|---|---|---|---|
| 标题 | title | min 200, flex | 是 | input | |
| 状态 | status | 120 | 否 | — | StatusBadge 显示 |
| 负责人 | assigneeId | 120 | 否 | — | 显示成员名字 |
| 优先级 | metadata.priority | 100 | 是 | select | low/medium/high |
| 标签 | metadata.tags | 150 | 否 | — | 显示逗号分隔 |
| 截止日期 | metadata.deadline | 120 | 是 | date | YYYY-MM-DD |
| AI 评分 | metadata.aiScores.average | 90 | 否 | — | 数字，无则 — |
| 最终工分 | metadata.finalPoints | 90 | 否 | — | 数字，无则 — |
| 创建时间 | createdAt | 150 | 否 | — | 格式 YYYY-MM-DD |

**表格配置**：
- `height="auto"` + `max-height="600"` 或父容器高度
- `virtual-y-config="{ enabled: true }"` 虚拟滚动
- `edit-config="{ trigger: 'click', mode: 'cell', showStatus: true }"`
- `sort-config="{ trigger: 'cell' }"` 列头排序
- `row-config="{ isHover: true, isCurrent: true }"`
- 点击行触发 `select:task` emit（排除点击编辑器时）

**行内编辑保存逻辑**：
- 监听 `edit-closed` 事件
- 判断字段是 `title`、`metadata.priority` 还是 `metadata.deadline`
- 调用 `taskApi.update(projectId, task.id, payload)` 保存
- 保存失败时：回滚单元格到原始值，toast 提示错误
- 保存成功：emit `update:task`

**底部新建行**：
- 表格下方渲染一个固定的输入行（不是 VxeTable 的 insertRow，而是独立的 `<div>` 行，样式对齐表格列宽）
- 标题列位置有一个 `+` 图标 + 输入框（placeholder "新建任务..."）
- 输入标题后按 Enter 或失去焦点：调用 `taskApi.create(projectId, { title })`
- 创建成功：emit `create:task`，清空输入框
- 创建中显示 loading 状态

**状态显示**：
- 状态列用文字 + 色点显示（复用 StatusBadge 组件或内联样式）

### 不改动的文件

- `ProjectDetailPage.vue`（T6 的工作）
- 自定义列（T5 的工作）

## 验收标准

1. `pnpm --filter frontend run build` 编译通过，无 TypeScript 错误
2. 组件文件 `frontend/src/components/TaskDataGrid.vue` 存在
3. Props 类型完整（tasks/loading/projectId/members）
4. 固定列全部定义（9 列）
5. `edit-closed` 事件中调用 `taskApi.update()`，失败时有回滚逻辑
6. 底部新建行触发 `taskApi.create()`
7. 所有三个 emit（update:task / create:task / select:task）有定义和调用

## 技术约束

- 使用 `vxe-table` 全局注册的组件（`<vxe-table>`, `<vxe-column>` 等），无需再 import
- TypeScript 严格模式：所有类型必须正确，不能有 `any`（除非 VxeTable 内部类型无法避免）
- `metadata.priority` 和 `metadata.deadline` 的读写要通过 `task.metadata` 路径，保存时 payload 为 `{ metadata: { ...task.metadata, priority: newValue } }`
