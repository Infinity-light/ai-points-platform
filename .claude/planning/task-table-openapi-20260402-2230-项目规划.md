# 项目规划：任务多维表格 + Open API + AI 配置中心

## 背景与目标

当前任务系统是简单列表视图，创建时需填预估工分（无实际意义），平台无对外 API 接口，LLM 配置硬编码在环境变量中。本次改造：

1. 精简任务模型（去掉 estimatedPoints），简化结算公式
2. VxeTable 多维表格替换任务列表，支持行内编辑和自定义列
3. AI 配置中心：LLM Key 轮询池（出站）+ Open API Key（入站）
4. 全平台 Open API，API Key 鉴权，权限继承成员角色
5. 评审会议投票改为直接投工分数，中位数即最终工分

**PRD**：`.claude/discovery/task-table-openapi-20260402-2200-PRD.md`

## 关键决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 表格组件 | VxeTable v4 | 中文生态最强，原生行内编辑，MIT |
| 样式集成 | VxeTable 原生 + CSS 变量覆盖暗色主题 | 工作量最小 |
| Open API 路由 | 双 Guard（JWT OR ApiKey）复用现有 Controller | DRY，无代码重复 |
| Sprint 划分 | 3 个 Sprint | S1 后端为主，S2 前端大改，S3 新模块 |

---

## Sprint 1：任务模型精简 + 评审会议改造

### 模块 A：任务模型精简

**职责**：去除 estimatedPoints 在 UI 和结算中的作用

**后端改动**：
- `CreateTaskDto`：移除 `estimatedPoints` 字段验证（保留数据库列，不做迁移）
- `TaskService.create()`：不再写入 estimatedPoints
- `UpdateTaskDto`：移除 estimatedPoints

**前端改动**：
- `ProjectDetailPage.vue`：移除 `newTaskPoints` 变量和预估工分输入框
- `services/task.ts`：移除 `CreateTaskPayload.estimatedPoints`

**结算改动（SettlementService）**：
- `settleFromMeeting()`：`finalPoints = taskResult.finalScore`（不再乘以 estimatedPoints/15）
- `triggerSettlement()`：同上改造
- `settleProject()`：同上改造

### 模块 B：评审会议改造

**职责**：投票从「认可/质疑 AI 分」改为「直接投工分数」

**当前机制**（需改造）：
- `ReviewVote` 有 `isApproval: boolean` + `score: number | null`
- 认可 AI → isApproval=true, score=null
- 质疑 → isApproval=false, score=自定义总分(0-15)
- `confirmTask()` 中：认可票映射为 aiTotalScore，质疑票取 score，算中位数
- 结算：`finalPoints = max(1, round(estimatedPoints × finalScore/15))`

**改造为**：
- `ReviewVote`：废弃 `isApproval`，`score` 改为必填（正整数，无上限）
- 投票含义：每人直接投一个工分数（代表"我认为这个任务值 X 工分"）
- AI 三维评分仍展示为参考卡片，但不参与计算
- `confirmTask()`：所有 votes 的 score 取中位数 = finalScore
- 结算：`finalPoints = finalScore`（直接赋值，不再有乘法公式）

**后端文件改动**：

1. `backend/src/meeting/entities/review-vote.entity.ts`
   - `score` 改为 `NOT NULL`，`decimal(10,0)` 正整数
   - `isApproval` 保留列但在新流程中不使用（向后兼容）

2. `backend/src/meeting/meeting.service.ts`
   - `CastVoteDto` 改为 `{ points: number }`（去掉 isApproval/score）
   - `castVote()`：直接写入 score=points
   - `confirmTask()`：所有 votes 的 score 取中位数，不再区分 approval/challenge
   - `getVoteStats()`：返回 medianPoints 而非 medianScore

3. `backend/src/meeting/meeting.gateway.ts`
   - `vote` 事件 data 改为 `{ meetingId, taskId, points }`

4. `backend/src/settlement/settlement.service.ts`
   - `settleFromMeeting()`：`finalPoints = taskResult.finalScore`
   - `triggerSettlement()`：`finalPoints = aiTotal`（无 estimatedPoints 乘数）
   - `settleProject()`：同上

**前端文件改动**：

5. `frontend/src/pages/meeting/MeetingPage.vue`
   - 投票 UI：从「认可/质疑」双按钮改为一个工分数输入框 + 确认按钮
   - AI 评分作为只读参考卡片展示

6. `frontend/src/services/meeting.ts`
   - 更新投票相关类型

**数据库迁移**：

7. `backend/src/database/migrations/1700000000020-SimplifyVoteAndPoints.ts`
   - `review_votes.score` 改为 NOT NULL（给历史 null 值填充默认 0）
   - 不删除 `isApproval` 列和 `tasks.estimatedPoints` 列（保留向后兼容）

### Sprint 1 原子任务清单

- [ ] T1. 创建 migration 简化投票和工分
  - 文件：`backend/src/database/migrations/1700000000020-SimplifyVoteAndPoints.ts`
  - 变更：`ALTER TABLE review_votes ALTER COLUMN score SET NOT NULL SET DEFAULT 0; UPDATE review_votes SET score = 0 WHERE score IS NULL;`
  - 验证：`pnpm --filter backend run build` 成功
  - 预期：编译通过
  - 前置：无

- [ ] T2. 改造 ReviewVote entity
  - 文件：`backend/src/meeting/entities/review-vote.entity.ts`
  - 变更：`score` 列改为 `{ type: 'integer', nullable: false, default: 0 }`，保留 `isApproval` 不动
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T1

- [ ] T3. 改造 MeetingService 投票逻辑
  - 文件：`backend/src/meeting/meeting.service.ts`
  - 变更：
    - `CastVoteDto` 改为 `{ points: number }`
    - `castVote()`：移除 isApproval 分支，直接 `vote.score = dto.points; vote.isApproval = false;`
    - `confirmTask()`：所有 votes 的 `score` 取中位数作为 `finalScore`，去掉 aiTotalScore 参数
    - `getVoteStats()`：返回全部 votes 的 medianPoints
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T2

- [ ] T4. 改造 MeetingGateway Socket 事件
  - 文件：`backend/src/meeting/meeting.gateway.ts`
  - 变更：
    - `handleVote` data 类型改为 `{ meetingId, taskId, points }`
    - 调用 `meetingService.castVote` 传 `{ points: data.points }`
    - `handleConfirm` 移除 `aiTotalScore` 参数
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T3

- [ ] T5. 改造 SettlementService 结算公式
  - 文件：`backend/src/settlement/settlement.service.ts`
  - 变更：
    - `settleFromMeeting()`：`finalPoints = taskResult.finalScore`（删除 `qualityRatio` 和 `estimatedPoints` 乘法）
    - `triggerSettlement()`：`finalPoints = aiTotal`（删除 estimatedPoints 乘法）
    - `settleProject()`：同上
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T3

- [ ] T6. 精简 CreateTaskDto 和 TaskService
  - 文件：`backend/src/task/dto/create-task.dto.ts`, `backend/src/task/task.service.ts`
  - 变更：
    - `CreateTaskDto` 移除 `estimatedPoints` 字段（@IsInt/@Min/@Max 验证）
    - `TaskService.create()` 不再写入 `estimatedPoints`
    - `UpdateTaskDto` 移除 `estimatedPoints`（如有）
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：无

- [ ] T7. 前端：移除任务创建中的预估工分
  - 文件：`frontend/src/pages/project/ProjectDetailPage.vue`, `frontend/src/services/task.ts`
  - 变更：
    - 删除 `newTaskPoints` ref 和模板中的预估工分 input
    - `createTask()` 不再传 `estimatedPoints`
    - `CreateTaskPayload` 移除 `estimatedPoints` 字段
    - 任务行中移除 `~N分` 显示（`task.estimatedPoints` 相关）
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T6

- [ ] T8. 前端：改造评审会议投票 UI
  - 文件：`frontend/src/pages/meeting/MeetingPage.vue`
  - 变更：
    - 投票区域：从「认可 AI / 质疑」双按钮改为一个数字输入框（label: "投出工分"）+ 确认按钮
    - AI 三维评分保留为只读参考卡片
    - Socket vote 事件 payload 改为 `{ meetingId, taskId, points }`
    - confirm 事件移除 `aiTotalScore` 参数
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T4, T7

---

## Sprint 2：多维表格

### 模块 C：VxeTable 多维表格

**职责**：替换项目详情页的任务列表为可编辑多维表格

**技术依赖**：`vxe-table`（MIT，Vue 3.2+）

**固定列**：

| 列 | 字段 | 类型 | 可编辑 | 编辑器 |
|---|---|---|---|---|
| 标题 | title | text | 是 | input |
| 状态 | status | enum | 否（通过操作按钮） | — |
| 负责人 | assigneeId | uuid | 否（通过认领） | — |
| 优先级 | metadata.priority | enum | 是 | select(low/medium/high) |
| 标签 | metadata.tags | string[] | 是 | multi-select |
| 截止日期 | metadata.deadline | date | 是 | date-picker |
| AI 评分 | metadata.aiScores.average | number | 否 | — |
| 最终工分 | metadata.finalPoints | number | 否 | — |
| 创建时间 | createdAt | datetime | 否 | — |

**自定义列**：
- 存储在 `project.metadata.customFields: FieldDef[]`
- `FieldDef = { key, name, type, options?, order }`
- 值存入 `task.metadata[key]`
- 支持类型：text, number, date, single_select, multi_select

**组件树**：
```
ProjectDetailPage
└── TasksTab
    ├── TaskTableToolbar
    │   ├── StatusFilterTabs
    │   ├── ColumnManagerButton → ColumnManagerPanel (drawer)
    │   └── AddTaskButton
    ├── VxeTable (TaskDataGrid)
    │   ├── 固定列 columns
    │   ├── 自定义列 columns（动态生成）
    │   └── NewTaskRow（底部空行，输入标题创建）
    └── TaskDetailSidebar (点击行展开)
```

### Sprint 2 原子任务清单

- [ ] T9. 安装 VxeTable 依赖
  - 文件：`frontend/package.json`
  - 变更：`pnpm --filter frontend add vxe-table`
  - 验证：`ls frontend/node_modules/vxe-table`
  - 预期：目录存在
  - 前置：无

- [ ] T10. VxeTable 全局注册 + 暗色主题 CSS 变量
  - 文件：`frontend/src/main.ts`, `frontend/src/style.css`
  - 变更：
    - `main.ts` 中 `import VxeTable from 'vxe-table'; import 'vxe-table/lib/style.css'; app.use(VxeTable);`
    - `style.css` 中添加 `.dark` 作用域的 VxeTable CSS 变量覆盖（背景色、边框色、文字色匹配现有暗色主题）
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T9

- [ ] T11. 创建 TaskDataGrid 组件（基础表格）
  - 文件：`frontend/src/components/TaskDataGrid.vue`
  - 变更：
    - Props：`tasks: Task[]`, `loading: boolean`, `projectId: string`
    - Emits：`update:task`, `create:task`, `select:task`
    - VxeTable 配置：固定列定义、虚拟滚动、行选中高亮
    - 列排序/筛选启用
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T10

- [ ] T12. TaskDataGrid 行内编辑功能
  - 文件：`frontend/src/components/TaskDataGrid.vue`
  - 变更：
    - `editConfig: { trigger: 'click', mode: 'cell' }`
    - 标题列：input 编辑器
    - 优先级列：select 编辑器（low/medium/high）
    - 标签列：多选编辑器
    - 截止日期列：date 编辑器
    - `edit-closed` 事件中调用 `taskApi.update()` 保存，失败回滚
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T11

- [ ] T13. TaskDataGrid 底部新建行
  - 文件：`frontend/src/components/TaskDataGrid.vue`
  - 变更：
    - 表格底部渲染一个空行（insertRow），标题列可输入
    - Enter 或 blur 触发 `taskApi.create()`，成功后刷新列表
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T12

- [ ] T14. 自定义列管理后端 API
  - 文件：`backend/src/project/project.service.ts`, `backend/src/project/project.controller.ts`
  - 变更：
    - `ProjectService` 新增 `getCustomFields(projectId)` 和 `updateCustomFields(projectId, fields: FieldDef[])`
    - 读写 `project.metadata.customFields`
    - Controller 新增 `GET /projects/:id/custom-fields` 和 `PUT /projects/:id/custom-fields`
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：无

- [ ] T15. 前端自定义列管理面板
  - 文件：`frontend/src/components/ColumnManagerPanel.vue`
  - 变更：
    - Drawer/侧边面板，展示固定列（不可删）+ 自定义列
    - 添加列：输入名称、选择类型、配置选项
    - 删除/排序自定义列
    - 保存调用 `PUT /projects/:id/custom-fields`
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T14

- [ ] T16. TaskDataGrid 集成自定义列
  - 文件：`frontend/src/components/TaskDataGrid.vue`
  - 变更：
    - 加载项目的 customFields 定义
    - 动态生成 VxeTable 列配置
    - 行内编辑：根据 type 选择编辑器（text→input, number→number-input, date→date, single_select→select, multi_select→multi-select）
    - 编辑保存写入 `task.metadata[key]`
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T15

- [ ] T17. 替换 ProjectDetailPage 任务区域
  - 文件：`frontend/src/pages/project/ProjectDetailPage.vue`
  - 变更：
    - 任务 Tab 内容替换为 `<TaskDataGrid>`
    - 移除旧的任务列表渲染代码、筛选逻辑
    - 保留右侧详情侧栏（TaskDetailSidebar），由 `select:task` 事件触发
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T16

---

## Sprint 3：AI 配置中心 + Open API

### 模块 D：AI 配置中心

**职责**：统一管理 LLM 出站配置和平台入站 API Key

**数据库新表**：

| 表名 | 关键字段 | 用途 |
|------|---------|------|
| `ai_providers` | id, tenantId, name, baseUrl, model, isActive, createdAt | LLM 服务源 |
| `ai_provider_keys` | id, providerId, keyEncrypted, isActive, cooldownUntil, usageCount | LLM Key 池 |
| `open_api_keys` | id, tenantId, userId, name, keyHash, lastUsedAt, revokedAt, createdAt | 平台 Open API Key |

**后端改动**：

- 新模块 `backend/src/ai-config/`：
  - `AiProviderService`：CRUD providers + keys，轮询调度逻辑
  - `OpenApiKeyService`：生成/吊销 Key，验证 Key
  - 改造 `AiService`：从 `AiProviderService` 获取当前可用 Key，而非硬编码 env var

- 鉴权改造 `backend/src/auth/`：
  - 新增 `ApiKeyGuard`：从 `X-API-Key` header 解析 Key → 查 `open_api_keys` → 加载关联 user → 注入 `RequestUser`
  - 新增 `CompositeAuthGuard`：JWT OR ApiKey，任一通过即可
  - 现有 Controller 的 `@UseGuards(JwtAuthGuard, PoliciesGuard)` 改为 `@UseGuards(CompositeAuthGuard, PoliciesGuard)`

**前端改动**：

- 管理后台新增「AI 配置」Tab
  - 「AI 服务源」子 Tab：源列表 CRUD + 每个源的 Key 管理
  - 「Open API」子 Tab：Key 列表 + 生成弹窗（关联成员选择）

### Sprint 3 原子任务清单

- [ ] T18. 创建 migration 新增 ai_providers, ai_provider_keys, open_api_keys 表
  - 文件：`backend/src/database/migrations/1700000000021-AiConfigAndOpenApi.ts`
  - 变更：创建三张新表，含索引和外键
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：无

- [ ] T19. 创建 AI 配置模块 entities
  - 文件：`backend/src/ai-config/entities/ai-provider.entity.ts`, `ai-provider-key.entity.ts`, `open-api-key.entity.ts`
  - 变更：TypeORM entity 定义，对应三张新表
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T18

- [ ] T20. AiProviderService — LLM 源和 Key 管理
  - 文件：`backend/src/ai-config/ai-provider.service.ts`
  - 变更：
    - CRUD providers 和 keys
    - `getActiveKey(tenantId)`: 轮询选择可用 Key（跳过 cooldown 中的），返回 { apiKey, baseUrl, model }
    - 调用失败时 `markCooldown(keyId, 5min)`
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T19

- [ ] T21. OpenApiKeyService — 平台 API Key 管理
  - 文件：`backend/src/ai-config/open-api-key.service.ts`
  - 变更：
    - `generate(tenantId, userId, name)`: 生成随机 Key，bcrypt hash 存储，返回原文（仅一次）
    - `validate(rawKey)`: 遍历有效 Key 做 bcrypt compare，返回 { tenantId, userId } 或 null
    - `revoke(keyId)`: 设置 revokedAt
    - `list(tenantId)`: 返回该租户所有 Key（不含 hash）
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T19

- [ ] T22. AiConfig Module 注册
  - 文件：`backend/src/ai-config/ai-config.module.ts`, `backend/src/app.module.ts`
  - 变更：创建 AiConfigModule，注册 entities/services/controllers，import 到 AppModule
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T20, T21

- [ ] T23. AiConfig Controller — REST API
  - 文件：`backend/src/ai-config/ai-config.controller.ts`
  - 变更：
    - `GET/POST/PATCH/DELETE /ai-config/providers` — LLM 源 CRUD
    - `GET/POST/DELETE /ai-config/providers/:id/keys` — LLM Key 管理
    - `GET/POST/DELETE /ai-config/open-api-keys` — Open API Key 管理
    - 所有接口需 super_admin/hr_admin 权限
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T22

- [ ] T24. 改造 AiService 使用 AiProviderService
  - 文件：`backend/src/ai/ai.service.ts`
  - 变更：
    - 注入 `AiProviderService`
    - `reviewSubmission()` 中：调用 `getActiveKey(tenantId)` 获取 Key/baseUrl/model
    - 每次 LLM 调用失败时调用 `markCooldown(keyId)`
    - 保留 env var 作为 fallback（无 provider 配置时用环境变量）
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T22

- [ ] T25. ApiKeyGuard — Open API 鉴权
  - 文件：`backend/src/auth/guards/api-key.guard.ts`
  - 变更：
    - 从 `X-API-Key` header 读取 raw key
    - 调用 `OpenApiKeyService.validate(rawKey)` 获取 userId/tenantId
    - 查询 user，构造与 JWT 相同的 `RequestUser` 对象注入 request
    - 更新 `lastUsedAt`
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T21

- [ ] T26. CompositeAuthGuard — JWT OR ApiKey
  - 文件：`backend/src/auth/guards/composite-auth.guard.ts`
  - 变更：
    - 依次尝试 JwtAuthGuard → ApiKeyGuard
    - 任一成功即通过，全失败则 401
    - 在 request 上标记 `source: 'web' | 'open_api'`
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T25

- [ ] T27. 现有 Controller 改用 CompositeAuthGuard
  - 文件：所有使用 `@UseGuards(JwtAuthGuard, PoliciesGuard)` 的 Controller
  - 变更：全局替换 `JwtAuthGuard` → `CompositeAuthGuard`（约 8 个文件）
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T26

- [ ] T28. 审计拦截器记录 API 来源
  - 文件：`backend/src/audit/audit.interceptor.ts`
  - 变更：从 request 读取 `source` 字段，写入 audit_logs
  - 验证：`pnpm --filter backend run build`
  - 预期：编译通过
  - 前置：T27

- [ ] T29. 前端：管理后台 AI 配置页 — LLM 服务源
  - 文件：`frontend/src/pages/admin/tabs/AiConfigTab.vue`
  - 变更：
    - 两个子 Tab：「AI 服务源」/「Open API」
    - AI 服务源 Tab：表格展示源列表，CRUD 弹窗，每行可展开 Key 管理
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T23

- [ ] T30. 前端：管理后台 AI 配置页 — Open API Key
  - 文件：`frontend/src/pages/admin/tabs/AiConfigTab.vue`（继续）
  - 变更：
    - Open API Tab：Key 列表（名称、关联成员、最后使用、创建时间）
    - 「生成 Key」弹窗：选择关联成员 → 生成 → 显示完整 Key（带复制按钮，关闭后不可再查看）
    - 吊销按钮
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T29

- [ ] T31. 管理后台路由注册 AI 配置 Tab
  - 文件：`frontend/src/pages/admin/AdminPage.vue`, `frontend/src/services/ai-config.ts`
  - 变更：
    - AdminPage 新增 AI 配置 tab
    - 创建 `ai-config.ts` service 封装所有 AI 配置 API 调用
  - 验证：`pnpm --filter frontend run build`
  - 预期：编译通过
  - 前置：T30

---

## 质量保障策略

- 每个 Sprint 完成后运行 `pnpm --filter backend run build` + `pnpm --filter frontend run build` 确保编译通过
- 后端 migration 在本地 Docker 环境验证后推送
- 评审会议改造需手动测试 Socket.IO 投票流程
- VxeTable 集成需在浏览器中验证暗色主题和行内编辑

## 风险与应对

| 风险 | 应对 |
|------|------|
| VxeTable CSS 与 Tailwind 冲突 | CSS 变量覆盖 + scoped 样式隔离 |
| Open API Key bcrypt validate 性能（遍历所有 Key） | Key 加前缀标识，先按前缀筛选再 compare |
| 评审会议改造影响进行中的会议 | 保留 isApproval 列，旧数据不迁移 |
| LLM Key 轮询池所有 Key cooldown | 所有 Key 失败时 fallback 到 env var 配置 |

## 验证方案

### Sprint 1 验收
1. 创建任务：只有标题+描述，无预估工分输入
2. 评审会议：投票直接输入工分数，确认后中位数显示为最终工分
3. 结算：最终工分 = 投票中位数，不再乘以 estimatedPoints

### Sprint 2 验收
1. 项目详情页任务 Tab 展示 VxeTable 表格
2. 点击单元格可编辑标题/优先级/标签/截止日期
3. 表格底部可新建任务
4. 列管理面板可添加/删除自定义列

### Sprint 3 验收
1. 管理后台 AI 配置页可管理 LLM 源和 Key
2. 生成 Open API Key 并用 curl 带 `X-API-Key` header 调用任务 API
3. API 操作受关联成员权限限制
4. 审计日志区分 web/open_api 来源
