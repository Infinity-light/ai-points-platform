# PRD: 任务多维表格 + Open API + AI 配置中心

## 1. 目标

将任务系统从简单列表升级为飞书风格的多维表格，精简任务模型（去掉预估工分），开放全平台 Open API 供外部工具调用，并建立统一的 AI 配置中心管理出入站 Key。

## 2. 约束与边界

### 必须满足
- 向后兼容：已有任务数据的 `estimatedPoints` 字段保留但不再使用，不做破坏性迁移
- Open API Key 权限继承成员角色权限，操作等同于该成员亲自操作
- 审计日志区分 API 调用来源（`source: 'web' | 'open_api'`）
- 表格视图需支持 500+ 行任务的流畅操作（虚拟滚动）

### 明确不做
- 第一版不做看板/甘特图视图，只做表格视图
- 不做 OAuth 2.0 授权流程，只做 API Key 静态鉴权
- 不做公式列/关联列等高级自定义字段类型
- LLM Key 轮询池的用量统计/费用分析不在此版本

## 3. 技术栈

| 层面 | 选型 |
|------|------|
| 表格组件 | VxeTable v4（MIT，Vue 3.2+，中文生态，原生行内编辑） |
| 后端框架 | NestJS（现有） |
| 数据库 | PostgreSQL 15（现有，jsonb 存自定义字段） |
| 鉴权 | JWT（现有人类用户）+ API Key Guard（新增，Open API） |
| 部署 | Docker Compose（现有） |

## 4. 用户操作动线

### 项目成员 — 使用多维表格

1. 进入项目详情页 → 「任务」Tab 展示 VxeTable 表格
2. 看到固定列：标题、状态、负责人、优先级、标签、截止日期、AI评分、最终工分、创建时间
3. 如果项目负责人配置了自定义列，也会显示在固定列之后
4. 点击列头排序；点击筛选图标按条件筛选；右键列头选择显隐列
5. 点击单元格直接编辑（标题/描述/优先级/标签/截止日期/自定义字段）
6. 表格底部点击「+ 新任务」行，输入标题即可创建，描述在行内或侧栏补充
7. 点击任一行展开右侧详情侧栏，查看完整描述、提交记录、AI 评分详情

### 项目负责人 — 管理自定义列

1. 表格工具栏点击「列管理」按钮
2. 弹出列配置面板：看到所有固定列（不可删除）+ 自定义列
3. 点击「添加列」→ 输入列名、选择类型（文本/数字/日期/单选/多选）
4. 单选/多选类型需配置选项列表
5. 保存后表格立即出现新列，所有任务该字段初始为空
6. 可拖拽排序列顺序、删除自定义列

### 管理员 — AI 配置中心

#### 出站配置（调用外部 LLM）
1. 管理后台 → AI 配置 → 「AI 服务源」Tab
2. 看到已配置的 LLM 源列表（名称、Base URL、模型、Key 数量、状态）
3. 点击「添加源」→ 填写名称、Base URL、模型名
4. 进入源详情 → Key 管理 → 添加多个 API Key
5. Key 自动组成轮询池，运行时按序使用，失败切下一个

#### 入站配置（平台 Open API）
1. 管理后台 → AI 配置 → 「Open API」Tab
2. 看到已生成的 API Key 列表（名称、关联成员、创建时间、最后使用时间）
3. 点击「生成 Key」→ 选择关联成员 → 生成并显示 Key（仅显示一次）
4. Key 继承关联成员的角色权限
5. 可随时吊销 Key

### 外部工具 — 通过 Open API 操作

1. 在 HTTP Header 设置 `X-API-Key: <key>`
2. 调用 `GET /open-api/projects` 查看有权限的项目列表
3. 调用 `POST /open-api/projects/:id/tasks` 创建任务
4. 调用 `PATCH /open-api/tasks/:id` 更新任务
5. 调用 `POST /open-api/tasks/:id/transition` 状态转换（认领/提交等）
6. 调用 `POST /open-api/submissions` 提交成果
7. 所有操作受关联成员权限限制，审计日志记录 `source: 'open_api'`

### 评审会议 — 简化工分投票

1. 会议中逐个任务评审（现有流程不变）
2. 每个参会者对每个任务投一个工分数（无上限正整数）
3. 取所有投票的中位数 = 该任务的最终工分
4. AI 三维评分（调查/规划/执行）仍作为参考信息展示，但不参与计算
5. 会议结束 → 自动结算，`finalPoints = 投票中位数`

## 5. 模块设计

### 模块 A: 任务模型精简

- **职责**：去除预估工分，简化创建流程
- **核心功能**：
  - 创建任务只需 title + description
  - `estimatedPoints` 字段保留但不再在 UI 中展示和填写
  - 结算公式改为 `finalPoints = meetingVoteMedian`
- **关键业务规则**：
  - 历史数据不迁移，旧任务的 estimatedPoints 保留
  - 新任务 estimatedPoints 默认 null
  - 结算服务检测到 estimatedPoints 为 null 时，直接使用 finalScore 作为 finalPoints

### 模块 B: 多维表格

- **职责**：项目任务的表格化展示与行内编辑
- **核心功能**：
  - VxeTable 表格渲染任务列表
  - 固定列：标题、状态（下拉）、负责人（成员选择器）、优先级（单选）、标签（多选）、截止日期（日期选择器）、AI 评分（只读）、最终工分（只读）、创建时间（只读）
  - 项目级自定义列：存储在 `project.metadata.customFields` 中
  - 自定义列类型：文本、数字、日期、单选、多选
  - 列管理面板：增删改自定义列、排序列、显隐切换
  - 行内编辑：点击单元格即编辑，blur 或 Enter 保存
  - 新建行：表格底部固定「+ 新任务」行
  - 虚拟滚动：VxeTable 内置，支持大数据量
  - 筛选：列头筛选器，支持多条件组合
  - 排序：列头点击切换升/降序
- **页面/交互设计**：
  - 替换 ProjectDetailPage 的任务列表区域
  - 工具栏：筛选状态 tabs + 「列管理」按钮 + 「+ 新任务」按钮
  - 点击行弹出右侧详情侧栏（现有，保留）
  - 空状态：表格显示空行 + 居中提示文案
  - 加载中：VxeTable loading 状态
- **关键业务规则**：
  - 只读列（状态转换通过操作按钮、AI 评分由系统写入、最终工分由结算写入）
  - 行内编辑自动 debounce 保存（300ms），失败时回滚单元格值并 toast 提示
  - 自定义列数据存入 `task.metadata[fieldKey]`

### 模块 C: AI 配置中心

- **职责**：统一管理 AI 出入站配置
- **核心功能**：
  - **出站**：LLM 服务源 CRUD，每个源下多个 API Key 管理，轮询调度
  - **入站**：Open API Key 生成/吊销，关联成员，权限继承
- **页面/交互设计**：
  - 管理后台新增「AI 配置」菜单项，两个子 Tab
  - 「AI 服务源」Tab：源列表 + 源详情（Key 列表）
  - 「Open API」Tab：Key 列表 + 生成弹窗
  - 生成 Key 后弹窗显示完整 Key（带复制按钮），关闭后不可再查看
- **关键业务规则**：
  - LLM Key 轮询：按顺序尝试，单个 Key 调用失败标记 cooldown（5 分钟），切下一个
  - 所有 Key 都失败时抛出异常，任务重新入队（现有 AI 评审的失败处理逻辑）
  - Open API Key 使用 bcrypt hash 存储，原文仅在创建时返回一次
  - Open API Key 的权限 = 关联成员此刻的角色权限（实时查询，非快照）

### 模块 D: Open API 鉴权与端点

- **职责**：为外部工具提供平台操作接口
- **核心功能**：
  - `ApiKeyGuard`：从 `X-API-Key` header 解析 Key，查找关联成员，注入与 JWT 相同的 `RequestUser`
  - 复用现有 Controller 逻辑，API Key Guard 作为 JWT Guard 的替代鉴权路径
  - 端点前缀 `/open-api/`，路由映射到同一套 Service 层
  - 审计拦截器扩展：记录 `source` 字段区分 web / open_api
- **关键业务规则**：
  - Rate limiting：每个 Key 每分钟 60 次请求
  - Key 失效/吊销后立即生效，无缓存延迟
  - 响应格式与现有 API 完全一致（JSON）

### 模块 E: 评审会议改造

- **职责**：简化投票为直接投工分
- **核心功能**：
  - 投票输入从「质量分 0-15」改为「工分数（正整数，无上限）」
  - AI 三维评分作为参考卡片展示在投票界面
  - 中位数计算逻辑不变
  - 结算触发后 `finalPoints = median`，不再乘以 estimatedPoints
- **关键业务规则**：
  - 投 0 分合法（表示认为该任务无价值）
  - AI 评分仅供参考，不强制显示也不影响投票

## 6. 数据库设计

| 表名 | 关键字段 | 用途 |
|------|---------|------|
| `tasks`（改造） | 去除 UI 层对 `estimatedPoints` 的依赖 | 任务主表 |
| `projects`（改造） | `metadata.customFields: FieldDef[]` | 存储项目级自定义列定义 |
| `ai_providers` | id, tenantId, name, baseUrl, model, isActive, createdAt | LLM 服务源 |
| `ai_provider_keys` | id, providerId, keyEncrypted, isActive, cooldownUntil, usageCount | LLM API Key 池 |
| `open_api_keys` | id, tenantId, userId, name, keyHash, lastUsedAt, revokedAt, createdAt | 平台 Open API Key |

### 自定义列定义结构（存于 `projects.metadata.customFields`）

```typescript
interface FieldDef {
  key: string;        // 唯一标识，如 'cf_urgency'
  name: string;       // 显示名，如 '紧急度'
  type: 'text' | 'number' | 'date' | 'single_select' | 'multi_select';
  options?: string[]; // 仅 single_select / multi_select
  order: number;      // 列排序
}
```

自定义字段值存入 `tasks.metadata[fieldDef.key]`。

### 表间关系
- `ai_provider_keys.providerId` → `ai_providers.id`（多对一）
- `open_api_keys.userId` → `users.id`（多对一，继承权限）
- `open_api_keys.tenantId` → `tenants.id`（多对一）

## 7. 模块间关系

```
外部工具 (Claude Code 等)
    │
    ▼  X-API-Key
┌─────────────────┐
│ ApiKeyGuard      │ ──▶ open_api_keys 表 ──▶ 解析 userId + tenantId
└────────┬────────┘
         │ 注入 RequestUser（与 JWT 路径一致）
         ▼
┌─────────────────┐     ┌──────────────────┐
│ 现有 Controller  │────▶│ 现有 Service 层    │
│ (Task/Project/…) │     │ (TaskService 等)   │
└─────────────────┘     └────────┬─────────┘
         ▲                       │
         │ JWT                   ▼
┌────────┴────────┐     ┌──────────────────┐
│ 前端 VxeTable    │     │ AI Service        │
│ (多维表格视图)    │     │ (评审/智脑对话)    │
└─────────────────┘     └────────┬─────────┘
                                 │ 调用外部 LLM
                                 ▼
                        ┌──────────────────┐
                        │ LLM Key 轮询池    │
                        │ ai_providers +    │
                        │ ai_provider_keys  │
                        └──────────────────┘
```

核心设计：Open API 和 Web 端共享同一套 Service 层，区别仅在鉴权入口（ApiKeyGuard vs JwtAuthGuard）。审计拦截器通过 `source` 字段区分来源。
