# PRD: 赛托邦治理体系升级

## 1. 目标

将赛托邦从硬编码科层制升级为动态权限、民主评审、透明公示的自治协作平台——超级管理员拥有完整管理后台，角色权限可自定义，AI 评分可通过实时评审会议复议修正，所有工分/决策/审计轨迹公开可查，任务支持多人协作和工分竞拍。

## 2. 约束与边界

**必须满足：**
- 兼容现有数据：旧用户、旧任务、旧工分记录不丢失
- 后端 NestJS + TypeORM 技术栈不变
- 前端 Vue 3 + Tailwind + shadcn-vue 不变
- Docker Compose 部署架构不变
- 迁移需要短暂停机（一次性切换旧角色枚举到新动态角色表）

**明确不做：**
- 字段级权限（只做资源+动作级）
- 多角色叠加（一个用户在每个作用域只有一个角色）
- 分红打款自动化（打款仍需人工执行）
- 旧投票系统保留（完全由评审会议替代）

## 3. 技术栈

| 层面 | 选型 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Tailwind v3 + shadcn-vue + Lucide icons |
| 后端 | NestJS + TypeORM + PostgreSQL 15 + Redis 7 + Bull |
| 权限 | @casl/ability + 自建 CaslAbilityFactory（DB 驱动） |
| 实时通信 | Socket.IO（@nestjs/websockets + @nestjs/platform-socket.io） |
| 审计 | 全局 NestJS Interceptor（APP_INTERCEPTOR） |
| 部署 | Docker Compose（不变）|

## 4. 用户操作动线

### 4.1 超级管理员动线

侧边栏 → "管理后台" → `/admin` → 看到所有 Tab（用户管理、角色与权限、邀请码、工分审批、租户管理、审计日志、公示区设置、全局配置、运营数据）。

**创建自定义角色：** 角色与权限 Tab → "新建角色" → 填写名称和描述 → 进入权限矩阵（资源×动作勾选框）→ 保存 → 角色出现在列表中。

**分配角色：** 用户管理 Tab → 用户列表（姓名/邮箱/租户角色/项目数）→ 租户角色下拉可选所有角色（含 super_admin）→ 点击展开行查看用户在各项目中的角色 → 下拉修改项目角色。

**查看审计日志：** 审计日志 Tab → 时间/操作人/操作/资源/详情表格 → 支持筛选 → 点击行展开变更前后 JSON diff。

### 4.2 项目成员动线（评审会议）

任务提交后 → AI 自动评分 → 任务状态变为"待评审" → 所有提交内容实时可见于项目多维表格。

项目负责人开启评审会议 → 系统列出所有"待评审"任务 → 所有在线成员自动加入会议房间（Socket.IO）→ 负责人点击某一行 → 所有人屏幕同步聚焦到该行 → 显示 AI 评分详情。

**每条任务的评审操作（所有参会者）：**
- 认可 AI 评分 → 等同于投出 AI 原始总分
- 投出自己的分数 → 输入一个总分（无上限，支持 Bonus）

**多人任务（如果该任务有多个认领者）：**
- 会议界面额外显示"贡献分配"区域
- 参会者可以为每个认领者设定百分比（不要求合计 100%）

负责人点击"确认并下一项" → 系统实时计算当前任务的最终分数（所有投票者分数的中位数）→ 进入下一条。

负责人点击"结束会议" → 所有已确认任务自动进入结算 → 工分按最终分数和百分比分配给各认领者。

### 4.3 所有成员动线（公示区）

侧边栏 → "公示区" → `/bulletin` → 四个子页面：
1. **工分排行榜**：按项目维度，显示成员/原始工分/活跃工分/排名。按组织维度，跨项目汇总。数据来自结算时快照。
2. **账目公示**：每期结算记录（日期/项目/参与人/总工分）+ 分红记录（金额/比例/状态）。
3. **决策记录**：所有评审会议的完整记录——议题列表/每条任务的 AI 分/最终分/各人投票详情/参与率。
4. **审计轨迹**：管理操作简化版日志（谁在什么时候做了什么），不含技术细节。

公示区可见范围由租户设置控制：internal（登录可见）或 public（无需登录，姓名脱敏为"张**"）。

### 4.4 任务竞拍动线

任何成员可对任何标的物发起竞拍 → 填写标的物描述、截止时间、最低出价 → 竞拍发布。

其他成员看到竞拍公告 → 出价（活跃工分）→ 竞拍截止时自动开奖 → 最高出价者获得标的物 → 出价工分自动扣减。

**任务认领竞拍（自动嵌入）：** 单人任务有多人想认领时，系统自动创建竞拍 → 竞拍结束 → 赢家自动成为任务认领者 → 竞拍出价从其最终结算工分中扣除。

## 5. 模块设计

### M1: 动态角色权限系统

- **职责**：替代硬编码角色枚举，实现数据库驱动的动态 RBAC
- **核心功能**：
  1. 角色 CRUD（租户级角色 + 项目级角色）
  2. 权限矩阵管理（资源×动作勾选）
  3. CASL AbilityFactory 从 DB 加载权限构建 Ability
  4. PoliciesGuard 替代 RolesGuard，运行时校验权限
  5. 数据迁移：旧 users.role 枚举 → roles + user_roles 表

- **页面/交互设计**：
  - **角色列表页**（管理后台 Tab）：表格显示角色名/描述/类型(租户/项目)/是否系统角色/用户数。系统角色标记为不可删除。"新建角色"按钮打开创建表单。
  - **权限矩阵编辑器**：点击角色名进入。纵轴资源列表，横轴动作列表，勾选框交叉点。资源包括：users、projects、tasks、points、votes、settlements、dividends、tenants、config、audit、bulletin、auctions。动作包括：read、create、update、delete + 特殊动作（如 points:approve、settlements:trigger、votes:create、votes:close）。
  - 保存时即时生效，无需重新登录。
  - 空状态：没有自定义角色时显示提示"创建你的第一个自定义角色"。

- **关键业务规则**：
  - 系统预置 4 个租户级角色（super_admin/hr_admin/project_lead/employee）和 2 个项目级角色（lead/member），标记 `isSystem: true`，不可删除但权限可修改。
  - 每个用户在租户层有且仅有一个角色，在每个所属项目中有且仅有一个项目角色。
  - JWT token 只存 userId，每次请求从 DB 加载角色+权限构建 CASL Ability。
  - 一次性迁移：旧 `users.role` 值映射到新 `user_roles` 关联。旧 `project_members` 扩展 `projectRoleId` 字段。迁移脚本自动执行，迁移后删除旧 `role` 字段。

### M2: 统一管理后台

- **职责**：合并 HR 和 Super Admin 面板为统一入口，权限控制可见内容
- **核心功能**：
  1. 统一 `/admin` 路由，Tab 栏根据权限动态渲染
  2. 用户管理：列表+展开行（租户角色下拉 + 项目角色展开行）
  3. 迁移现有 HR 面板功能（邀请码、工分审批、统计）
  4. 迁移现有 Super 面板功能（租户管理、全局配置、运营数据）

- **页面/交互设计**：
  - **Tab 栏**：用户管理 | 角色与权限 | 邀请码 | 工分审批 | 租户管理 | 审计日志 | 公示区设置 | 全局配置 | 运营数据。每个 Tab 对应一个权限，无权限的 Tab 不渲染。
  - **用户管理**：表格列：姓名/邮箱/租户角色(下拉)/项目数/邮箱验证/注册时间。点击行展开显示该用户的所有项目及项目内角色（每行一个项目，角色可下拉修改）。
  - 侧边栏导航：`isAdminRole` 改为权限判断 `ability.can('read', 'admin')`，显示一个"管理后台"入口指向 `/admin`。
  - 旧路由 `/admin/hr` 和 `/admin/super` 做 redirect → `/admin`。

- **关键业务规则**：
  - Tab 可见性完全由权限驱动。前端登录时获取用户完整权限列表存入 Pinia store。
  - super_admin 预置角色默认看到所有 Tab。hr_admin 看到子集。自定义角色按配置。

### M3: 审计日志系统

- **职责**：记录所有管理操作的变更历史，全员可查
- **核心功能**：
  1. 全局 AuditInterceptor 拦截 POST/PATCH/DELETE 请求
  2. 记录操作人、操作类型、资源、变更前后数据
  3. 管理后台中的审计日志 Tab（管理员视角，完整数据）
  4. 公示区中的审计轨迹（简化版，对全员开放）

- **页面/交互设计**：
  - **管理后台审计日志 Tab**：表格列：时间/操作人/操作/资源/资源ID。支持按操作人下拉筛选、日期范围选择器、操作类型多选筛选。点击行展开显示 `previousData` vs `newData` 的 JSON diff（高亮变更字段）。分页，每页 20 条。
  - **公示区审计轨迹**：简化列表，只显示"张三 在 2026-04-01 修改了 用户角色"这种自然语言描述。不展示 JSON 细节。

- **关键业务规则**：
  - 只记录写操作（POST/PATCH/DELETE），不记录读操作。
  - UPDATE 操作在执行前先查询旧数据，执行后记录新数据。
  - 审计日志本身不可修改、不可删除（append-only）。
  - 记录范围：角色变更、结算触发、工分审批、评审会议操作、租户管理、配置修改、用户管理、竞拍操作。

### M4: 公示区

- **职责**：实现组织透明度，公开工分、账目、决策、审计信息
- **核心功能**：
  1. 工分排行榜（结算时快照）
  2. 账目公示（结算记录+分红记录）
  3. 决策记录（评审会议的完整投票详情）
  4. 审计轨迹（简化版管理操作日志）
  5. 租户级可见范围配置（internal/public）

- **页面/交互设计**：
  - **工分排行榜**：顶部切换维度（按项目/按组织）。按项目：表格列 排名/成员/原始工分/活跃工分，数据来自上一次结算快照。按组织：跨项目汇总排名。
  - **账目公示**：按时间倒序列出每期结算：日期/项目/参与人数/总发放工分。展开显示明细。分红记录：金额/分配比例/审批状态。
  - **决策记录**：列出所有评审会议：日期/项目/任务数/参与率。展开显示每条任务的 AI 分/最终分/各成员投票详情。
  - **审计轨迹**：自然语言描述的管理操作列表。
  - **公开模式**：无需登录访问 `/public/:tenantSlug/bulletin`。姓名脱敏："张**"。邮箱脱敏："a****@xx.com"。

- **关键业务规则**：
  - 排行榜数据不实时计算——每次结算完成时生成快照（新增 `points_snapshots` 表），公示区直接读快照。
  - 租户设置 `bulletinVisibility: 'internal' | 'public'`，默认 `internal`。
  - 公开模式的 API 跳过 JWT 认证，但通过 `tenantSlug` 路由参数查询数据。

### M5: 实时评审会议

- **职责**：替代旧投票系统，实现实时协作的 AI 评分复议、多人任务分配和 Bonus 评定
- **核心功能**：
  1. 会议生命周期管理（创建/加入/结束）
  2. Socket.IO 实时同步（聚焦行、投票状态、参会人数）
  3. 逐条评审：认可 AI 分 / 投出自定义总分（无上限）
  4. 多人任务贡献百分比分配（不要求合计 100%）
  5. 最终分数计算：所有参会者投分的中位数
  6. 会议结束自动触发结算

- **页面/交互设计**：
  - **会议入口**：项目详情页新增"开启评审会议"按钮（需 `votes:create` 权限）。点击后创建会议，所有项目成员收到通知。
  - **会议主界面**：
    - 顶部：会议标题（项目名+日期）、进度（3/8 已完成）、在线人数
    - 主体：多维表格——列为 任务名/提交人/AI 分/最终分/状态
    - 当前聚焦行高亮（橙色边框），由负责人控制
    - 聚焦行下方展开详情区：
      - 任务描述和提交内容摘要
      - AI 评分详情（研究/规划/执行）
      - 投票区："认可 AI 评分"按钮 + "投出我的分数"输入框
      - 实时统计：N 人认可 / N 人投分(中位数 X) / N 人未投
    - 如果是多人任务，额外显示贡献分配表格：认领者列表 + 百分比输入框
    - 底部：上一项 / 确认并下一项 / 结束会议（仅负责人可见后两个按钮）
  - **状态标识**：已认可(绿勾)、已复议(橙色警告)、当前(橙色菱形)、待审(灰色时钟)
  - **会议结束确认**：弹窗显示汇总（N 条认可、N 条复议、总发放工分），确认后自动结算

- **关键业务规则**：
  - 会议只能由具有 `votes:create` 权限的成员创建。
  - 所有项目成员可以加入会议参与投票。
  - "认可 AI 评分"等同于投出 AI 原始总分（research + planning + execution）。
  - 最终分数 = 所有参会者投分的中位数（如偶数人则取两个中间值平均，四舍五入取整）。
  - 多人任务：每个认领者获得 `finalPoints × (个人百分比/100)` 的工分。百分比不要求合计 100%——超过 100% 意味着团队认为这个任务产出超过预期，低于 100% 意味着未完全完成。
  - Bonus 机制：因为投分无上限，当中位数超过 15 时，`finalPoints = estimatedPoints × (median/15)` 自动超过预估值，这就是 Bonus。
  - Socket.IO 使用房间机制：每个会议一个房间 `meeting:{meetingId}`。
  - 事件：`meeting:focus`（负责人切换聚焦行）、`meeting:vote`（成员投票）、`meeting:stats`（实时统计更新）、`meeting:next`（确认并下一项）、`meeting:end`（结束会议）。
  - 会议结束时：自动调用 `SettlementService.triggerSettlement()` 处理所有已确认任务。
  - 任务状态机变更：`AI_REVIEWING → PENDING_REVIEW（新增）→ SETTLED`。`PENDING_REVIEW` 表示 AI 已评分、等待评审会议。旧的 `PENDING_VOTE` 状态映射到 `PENDING_REVIEW`。

### M6: 员工建项目

- **职责**：开放项目创建权限给所有成员
- **核心功能**：employee 预置角色的 `projects:create` 权限默认设为 true
- **关键业务规则**：任何登录成员都可以创建项目。创建者自动成为该项目的 `lead` 角色。

### M7: 通用竞拍引擎

- **职责**：提供独立的工分竞拍基础设施，可被任何业务模块灵活调用
- **核心功能**：
  1. 竞拍 CRUD（创建/出价/关闭/取消）
  2. 定时自动开奖（Bull 延迟任务）
  3. 事件驱动结果回写（NestJS EventEmitter）
  4. 工分扣减（赢家出价从工分中扣除）

- **页面/交互设计**：
  - **竞拍列表**：公示区或项目详情中新增"竞拍"板块。表格列：标的物/发起人/当前最高出价/截止时间/状态。
  - **竞拍详情**：点击进入。显示标的物描述、出价历史（时间线）、当前最高出价。"出价"按钮 + 金额输入框。出价需高于当前最高价。
  - **竞拍结果**：截止后显示赢家和中标价。标的物根据类型自动处理（如任务自动分配）。

- **关键业务规则**：
  - 竞拍货币为活跃工分。出价不锁定工分（仅中标时扣减），但如果赢家当时活跃工分不足以支付中标价，则工分可为负数（欠债需后续工作偿还）。
  - 任何成员可以发起竞拍（需 `auctions:create` 权限）。
  - 竞拍类型：`task_claim`（任务认领）、`reward`（奖励分配）、`custom`（自定义）。
  - 竞拍结束时发出 `auction.closed` 事件，各业务模块通过 Listener 处理结果回写：
    - `TaskAuctionListener`：将任务分配给赢家（设置 assigneeId）。
    - 未来可扩展其他 Listener。
  - 任务认领竞拍的自动触发：单人任务已有人认领时，第二人想认领 → 系统自动创建竞拍 → 第一人的认领转为出价 0 → 竞拍开始。竞拍时长默认 24h（项目可配置）。
  - 竞拍出价在结算时扣减：中标者的 `finalPoints -= bidAmount`。如果 finalPoints - bidAmount < 0，产生负工分记录。

## 6. 数据库设计

### 新增表

| 表名 | 关键字段 | 用途 |
|------|---------|------|
| `roles` | id, tenantId, name, description, scope(`tenant`/`project`), isSystem, createdAt, updatedAt | 角色定义 |
| `role_permissions` | id, roleId, resource, action | 角色-权限映射 |
| `user_roles` | id, userId, roleId | 用户-租户角色关联 |
| `audit_logs` | id, tenantId, actorId, actorName, action, resource, resourceId, previousData(JSONB), newData(JSONB), ipAddress, createdAt | 审计日志 |
| `points_snapshots` | id, tenantId, projectId, settlementRound, data(JSONB: [{userId, name, originalPoints, activePoints, rank}]), createdAt | 工分排行快照 |
| `review_meetings` | id, tenantId, projectId, createdBy, status(`open`/`closed`/`cancelled`), taskIds(UUID[]), results(JSONB), participantCount, createdAt, closedAt | 评审会议 |
| `review_votes` | id, meetingId, taskId, userId, tenantId, score(number, nullable), isApproval(boolean), createdAt | 评审投票（score=null+isApproval=true 表示认可 AI 分） |
| `task_contributions` | id, taskId, userId, tenantId, percentage(decimal), setInMeetingId, createdAt | 多人任务贡献分配 |
| `auctions` | id, tenantId, type(`task_claim`/`reward`/`custom`), targetEntity, targetId, description, status(`open`/`closed`/`cancelled`), minBid, endsAt, winnerId, winningBid, createdBy, createdAt | 竞拍 |
| `bids` | id, auctionId, userId, tenantId, amount(integer), createdAt | 出价记录 |

### 修改表

| 表名 | 变更 | 说明 |
|------|------|------|
| `users` | 删除 `role` 枚举字段 | 迁移到 user_roles 关联 |
| `project_members` | 新增 `projectRoleId` (FK → roles) | 项目级角色 |
| `tasks` | 新增 `claimMode`(`single`/`multi`)，修改状态机增加 `PENDING_REVIEW` | 多人任务 + 新状态 |
| `tenants` | `settings` JSONB 新增 `bulletinVisibility` 字段 | 公示区配置 |
| `projects` | `annealingConfig` JSONB 新增 `reviewNoticePeriodHours` 字段（保留扩展），新增 `auctionDurationHours` 字段 | 竞拍时长配置 |

### 删除/废弃表

| 表名 | 处理 |
|------|------|
| `vote_sessions` | 保留数据但不再新增，旧数据在公示区决策记录中仍可查看 |
| `vote_records` | 同上 |

### 表间关系

```
users ──1:1──> user_roles ──N:1──> roles (租户级角色)
users ──1:N──> project_members ──N:1──> roles (项目级角色)
roles ──1:N──> role_permissions

review_meetings ──1:N──> review_votes
review_meetings ──> tasks (taskIds 数组)
tasks ──1:N──> task_contributions

auctions ──1:N──> bids
auctions ──event──> tasks (task_claim 类型)
```

## 7. 模块间关系

```
M1 角色权限 ──────────────────────────────────────────┐
  │ 提供 CASL Ability 校验                             │
  ▼                                                    │
M2 管理后台 ◄─── M3 审计日志（Tab 之一）              │
  │                 │ 全局拦截器记录所有写操作          │
  │                 ▼                                   │
  │              M4 公示区 ◄─── 排行快照 ◄─── 结算     │
  │                 │                          ▲        │
  │                 │ 决策记录 ◄───────────────┤        │
  │                 │                          │        │
  │                 ▼                          │        │
  │              M5 评审会议 ──结束──> 自动结算 ─┘       │
  │                 │                                   │
  │                 │ Socket.IO 实时同步                │
  │                 │                                   │
  │              M7 竞拍引擎 ◄──event──> 任务分配       │
  │                 │                                   │
  │              M6 员工建项目（权限变更）──────────────┘
  │
  所有模块的 API 端点均受 PoliciesGuard (M1) 保护
```

**数据流：**

1. **任务生命周期**：创建 → 认领（或竞拍）→ 提交 → AI 评审 → 待评审 → 评审会议（复议/认可）→ 结算 → 工分发放
2. **工分流**：结算产生工分 → 快照写入 points_snapshots → 公示区读取快照 → 竞拍时工分作为出价货币
3. **权限流**：登录 → JWT 取 userId → DB 加载角色+权限 → CASL Ability → 每个 API 端点校验
4. **审计流**：任何写操作 → AuditInterceptor → audit_logs 表 → 管理后台+公示区展示
5. **实时流**：会议创建 → Socket.IO 房间 → 聚焦行同步/投票同步/统计同步 → 会议结束 → 触发结算
