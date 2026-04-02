# PRD: 飞书深度集成与工分流程优化

## 1. 目标

以「飞书为主、平台为辅」的定位，实现飞书多维表格与平台的双向同步，修复工分结算流程断裂，重构管理后台，让平台专注于飞书做不了的三件事：**多人贡献分配、AI 多字段评分、退火结算**。

## 2. 约束与边界

### 必须满足
- 飞书 Bitable 双向同步：飞书表→平台（任务数据）+ 平台→飞书（最终工分）
- 评审会议结束后自动结算，工分直接进入总工分池（APPROVED），取消单独审批步骤
- AI 评分支持多字段输入（工作成果说明 + 附件 + commit diff）
- 管理后台按功能拆分为独立页面

### 明确不做
- 智脑深化（文档 Skill 化、AI 任务分派）——列为下一阶段
- 任务提交 Skill 化——列为下一阶段
- 飞书一键创建应用（原 device flow 方案不可行，改为引导手动配置）
- 平台不替代飞书做任务日常管理，只做飞书做不了的增值处理

### 技术约束
- 飞书 Bitable API 有请求频率限制，同步需走 Bull 队列
- 飞书 Webhook 需要已配置的飞书应用有 `bitable:app` 和 `bitable:app:readonly` 权限
- 已安装 `lark-cli`（`@larksuite/cli`），App ID: `cli_a94d2360eff8dcee`

## 3. 技术栈

| 层面 | 选型 |
|------|------|
| 后端 | NestJS (TypeScript)，已有架构不变 |
| 前端 | Vue 3 + TypeScript + Vite，已有架构不变 |
| 数据库 | PostgreSQL 15，TypeORM migrations |
| 飞书 API | `@larksuiteoapi/node-sdk`（已集成），Bitable v1 API |
| 队列 | Bull + Redis（已有，复用 FEISHU_SYNC 队列模式） |
| 部署 | Docker Compose，CI/CD 不变 |

## 4. 用户操作动线

### 4.1 项目负责人：绑定飞书表

1. 进入项目设置页 → 新增「飞书表格绑定」区域
2. 输入飞书多维表格的 App Token 和 Table ID（从飞书表格 URL 中提取）
3. 点击「获取字段」→ 系统调用 Bitable API 拉取表的所有列定义
4. 配置字段映射：飞书列名 → 平台字段（标题、负责人、状态、工作成果说明、附件等）
5. 指定「最终工分」回写到飞书的哪一列（如不存在则自动创建）
6. 点击「保存并首次同步」→ 飞书表的所有行拉取到平台任务表
7. 同步完成后显示成功提示和同步的任务数量

### 4.2 员工：在飞书中工作，平台自动处理

1. 员工在飞书多维表格中完成任务，填写工作成果说明、上传附件
2. 飞书 Webhook 触发 → 平台自动同步更新
3. 当任务状态在飞书中改为「已提交」→ 平台自动触发 AI 三维评分
4. AI 评分完成 → 任务进入 PENDING_REVIEW 状态

### 4.3 项目负责人：开启评审会议

1. 进入项目页 → 评审会议入口
2. 创建会议 → 选择待审核的任务（PENDING_REVIEW 状态）
3. 团队成员通过 Socket.IO 实时加入
4. 逐条审核：查看 AI 评分（参考）+ 工作成果 → 每人投一个工分数
5. 多人任务：设定每人贡献百分比（如 55%/45%）
6. 确认所有任务 → 关闭会议
7. **自动结算**：最终工分 = 投分中位数，直接写为 APPROVED
8. **自动回写**：最终工分通过 Bitable API 写回飞书表对应行

### 4.4 管理员：独立功能页面

- 侧边栏「飞书集成」→ 独立页面：飞书应用配置、通讯录同步、Webhook 管理
- 侧边栏「AI 配置」→ 独立页面：LLM 源管理、Key 轮询池、Open API Key
- 侧边栏「管理后台」→ 精简页面：用户管理、权限矩阵、部门管理、审计日志
- super_admin 额外可见：租户管理、全局配置、运营数据、公示区设置

## 5. 模块设计

### M1: 飞书 Bitable 双向同步

- **职责**：实现飞书多维表格与平台任务表的实时双向数据同步
- **核心功能**：
  1. **表格绑定**：项目级配置，存储 Bitable App Token、Table ID、字段映射
  2. **飞书→平台同步**：Webhook 接收飞书表变更事件，创建/更新平台任务
  3. **平台→飞书回写**：结算完成后，将最终工分写回飞书表对应行
  4. **首次全量同步**：绑定时拉取所有现有行
  5. **多人任务解析**：飞书表一行多负责人 → 平台拆为 TaskContribution 记录
- **页面/交互设计**：
  - 项目设置页新增「飞书表格」卡片：输入框（App Token、Table ID）+ 字段映射下拉列表
  - 「获取字段」按钮：调用 API 后展示飞书表列名列表
  - 字段映射表格：左列飞书字段名，右列平台字段下拉选择
  - 「最终工分回写列」单独配置项
  - 同步状态指示器：最后同步时间、待同步数量、错误信息
  - 空状态：「尚未绑定飞书表格」+ 引导配置
  - 错误状态：飞书 API 调用失败显示具体错误（权限不足/Token 无效等）
- **关键业务规则**：
  - 一个项目只能绑定一张飞书表
  - 飞书表的行 record_id 作为唯一标识，与平台 task.id 建立映射
  - Webhook 事件去重：记录最后处理的 event_id，防止重复处理
  - 同步冲突：飞书端数据为准（飞书为主的定位）
  - 回写只在结算完成时触发，不实时回写中间状态

### M2: 评审会议→结算流程修复

- **职责**：修复会议结束到工分入池的全链路断裂
- **核心功能**：
  1. **接通自动结算**：会议关闭时自动调用 `settleFromMeeting()`
  2. **取消审批步骤**：工分直接写为 `APPROVED`，移除 `PROJECT_ONLY` 中间状态
  3. **自动触发回写**：结算完成后触发 M1 的飞书回写
- **页面/交互设计**：
  - 会议关闭按钮点击后：显示结算进度（「正在结算...」→「结算完成，X 个任务共 Y 工分」→「已回写飞书」）
  - 移除管理后台「工分审批」Tab
- **关键业务规则**：
  - `settleFromMeeting()` 在 `MeetingGateway.handleEnd()` 中调用
  - 工分 `poolStatus` 直接设为 `APPROVED`
  - 结算后递增 `project.settlementRound`，触发退火重算
  - 结算后创建 `points_snapshots` 快照
  - 如果项目绑定了飞书表，结算后自动触发回写任务（Bull 队列）

### M3: AI 评分多字段输入增强

- **职责**：扩展 AI 评分的输入源，支持同时读取多个字段
- **核心功能**：
  1. **多字段 Prompt 拼接**：工作成果说明 + 附件文本 + commit diff
  2. **附件文本提取**：PDF → text（pdf-parse），DOCX → text（mammoth）
  3. **Commit diff 获取**：通过 submission 中的 repoUrl + commitHash 拉取
- **关键业务规则**：
  - Prompt 模板不传提交人姓名（去主观化，已有设计）
  - 附件文本截断上限：每个附件最多 3000 tokens，总输入最多 10000 tokens
  - commit diff 只取 stat + 前 200 行变更
  - 三次调用取均值机制不变

### M4: 管理后台拆分重构

- **职责**：将 12 Tab 单页拆为功能独立页面，降低复杂度
- **核心功能**：
  1. **飞书集成页**（`/feishu-config`）：飞书应用配置、角色映射、通讯录同步、Webhook、同步日志
  2. **AI 配置页**（`/ai-config`）：LLM 服务源、Key 轮询池、Open API Key
  3. **精简管理后台**（`/admin`）：用户管理、权限矩阵、部门管理、审计日志
  4. super_admin 额外 Tab：租户管理、全局配置、运营数据、公示区设置
- **页面/交互设计**：
  - 侧边栏新增「飞书集成」和「AI 配置」独立入口（带权限控制）
  - 管理后台从 12 Tab 精简为 4-8 Tab（视角色而定）
  - 删除「工分审批」Tab（M2 取消了审批步骤）
  - 删除「邀请码管理」Tab（M5 移除了邀请码）
  - 删除死代码 `HrAdminPage.vue`、`SuperAdminPage.vue`
  - 修复侧边栏权限加载闪现 bug（加载完成前不渲染管理入口）

### M5: 邀请码移除 + 飞书应用配置重做

- **职责**：清理无效模块，修复不可用功能
- **核心功能**：
  1. **删除 InviteModule**：实体、服务、控制器、前端组件全部移除
  2. **删除 FeishuDeviceFlowService**：调用不存在的 API，彻底移除
  3. **飞书应用配置引导**：改为文档引导（在飞书开放平台创建应用 → 复制 App ID/Secret → 填入平台配置页）
- **关键业务规则**：
  - 注册不再有邀请码字段
  - `users` 表的 `inviteCodeUsed` 列保留（历史数据兼容），但不再写入
  - 企业人员准入通过飞书通讯录同步管理

### M6: 智脑深化（标记为下一阶段）

- **职责**：AI 驱动的任务建议和文档访问
- **本次不实施**，仅记录方向：
  - 文档访问 Skill 化（整体作为一个 Skill，覆盖所有文档类型）
  - 智脑对话时动态注入项目上下文
  - AI 任务分派建议 → 一键生成到任务表

## 6. 数据库设计

### 新增/修改表

| 表名 | 关键字段 | 用途 |
|------|---------|------|
| `feishu_bitable_bindings` (新增) | id, projectId, appToken, tableId, fieldMapping (JSONB), writebackFieldId, lastSyncAt, syncStatus | 项目与飞书多维表格的绑定关系 |
| `feishu_bitable_sync_records` (新增) | id, bindingId, feishuRecordId, taskId, lastSyncDirection, lastSyncAt, eventId | 飞书行与平台任务的映射关系，防止重复同步 |
| `tasks` (修改) | 新增 feishuRecordId (nullable) | 关联飞书表行 record_id |
| `point_records` (修改) | poolStatus 默认值改为 APPROVED | 取消 PROJECT_ONLY 中间状态 |
| `invite_codes` (删除) | — | 移除邀请码功能 |
| `invite_usages` (删除) | — | 移除邀请码功能 |

### 表间关系

- `feishu_bitable_bindings` N:1 `projects`（一个项目一个绑定）
- `feishu_bitable_sync_records` N:1 `feishu_bitable_bindings`
- `feishu_bitable_sync_records` 1:1 `tasks`（通过 feishuRecordId）

## 7. 模块间关系

```
飞书 Webhook
    │
    ▼
FeishuWebhookController ──→ FeishuBitableSyncService (M1)
                                    │
                                    ├─→ TaskService (创建/更新任务)
                                    │
                                    └─→ Bull Queue (防限速)
                                            │
                                            ▼
                                    Bitable API (回写最终工分)

MeetingGateway (handleEnd)
    │
    ▼
SettlementService.settleFromMeeting() (M2)
    │
    ├─→ PointsService.awardPoints() (poolStatus = APPROVED)
    │
    ├─→ AnnealingService (退火计算)
    │
    └─→ FeishuBitableSyncService.writebackPoints() (M1, 如已绑定)

SubmissionService (任务提交)
    │
    ▼
AiService.reviewSubmission() (M3, 多字段输入)
    │
    ├─→ 工作成果说明 (文本)
    ├─→ 附件内容 (PDF/DOCX 文本提取)
    └─→ Commit diff (GitHub API)
```

管理后台拆分（M4）和邀请码移除（M5）为独立的前端/后端清理工作，不改变核心数据流。
