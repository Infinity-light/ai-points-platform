# Sprint Contract: T2 — VxeTable 安装 + 全局注册 + 暗色主题

## 任务范围

**规划对应**：T9 + T10（安装 VxeTable 依赖 + 全局注册 + 暗色主题 CSS 变量覆盖）

## 交付物

### 1. 安装 vxe-table 依赖
- `frontend/package.json` 中新增 `vxe-table` 依赖
- `frontend/node_modules/vxe-table` 目录存在

### 2. frontend/src/main.ts 改动
- 导入 `vxe-table` 并注册到 Vue app
- 导入 `vxe-table/lib/style.css` 样式文件

### 3. frontend/src/style.css 改动
- 在 `.dark` 作用域下添加 VxeTable CSS 变量覆盖
- 覆盖 `--vxe-ui-*` 背景色、边框色、文字色，匹配项目现有暗色主题（`--background`、`--border`、`--foreground`、`--card` 等 CSS 变量值）

## 验收标准

1. `pnpm --filter frontend run build` 编译通过，无 TypeScript 错误
2. `frontend/node_modules/vxe-table` 目录存在
3. `main.ts` 已包含 `app.use(VxeTable)` 和样式导入
4. `style.css` 已包含 `.dark` 作用域下的 VxeTable CSS 变量覆盖（至少覆盖背景、边框、文字三类变量）

## 不在此任务范围内

- TaskDataGrid 组件创建（T3 的工作）
- 自定义列管理（T5 的工作）

## 技术说明

- vxe-table v4 CSS 变量前缀为 `--vxe-ui-`
- 暗色主题：背景色约 `hsl(224, 33%, 11%)` (--card)，边框 `hsl(220, 13%, 87%)` 对应暗色 `hsl(224, 25%, 18%)`，文字 `hsl(210, 40%, 96%)` (--foreground)
