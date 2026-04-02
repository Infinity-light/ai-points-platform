# 项目规划：飞书深度集成与工分流程优化

## 背景与目标

**问题**：平台评审会议结束后工分不会自动结算（`settleFromMeeting()` 从未被调用），邀请码系统完全未接通，管理后台 12 Tab 臃肿，飞书集成一键创建不可用。飞书多维表格无法做多人贡献分配和多字段 AI 评分，但飞书是团队日常工具。

**目标**：以「飞书为主、平台为辅」定位，修复结算流程断裂，清理无效模块，重构管理后台，实现飞书 Bitable 双向同步和 AI 评分多字段输入。

**PRD**：`.claude/discovery/feishu-deep-integration-20260403-PRD.md`

---

## 关键决策

### 决策 1：结算触发方式
- **选择**：Event-driven——`MeetingService.closeMeeting()` 结束后通过 `EventEmitter` 发射 `meeting.closed` 事件，`SettlementService` 使用 `@OnEvent('meeting.closed')` 监听并执行 `settleFromMeeting()`
- **理由**：避免 MeetingModule ↔ SettlementModule 循环依赖；与现有 `feishu.webhook` 事件模式一致；`auction.closed` 事件已有此模式（`task-auction.listener.ts`）

### 决策 2：Bitable 配置存储
- **选择**：新增 `feishu_bitable_bindings` 独立表，而非扩展 `project.metadata` jsonb
- **理由**：字段映射数据结构复杂（嵌套 JSONB），需要 lastSyncAt/syncStatus 等运维字段，独立表可建索引查询

### 决策 3：Webhook 事件监听
- **选择**：创建统一的 `FeishuWebhookListener` 服务，用 `@OnEvent('feishu.webhook')` 监听并路由到对应处理器
- **理由**：现有 webhook controller 发射 `feishu.webhook` 事件但**无任何监听者**（`processWebhookEvent` 是死代码）。统一监听器同时处理通讯录事件和 Bitable 事件

### 决策 4：邀请码移除策略
- **选择**：代码全删 + 数据库列保留（`users.inviteCodeUsed` 保留为 nullable 历史字段，不写入新数据）
- **理由**：避免数据迁移风险，invite_codes/invite_usages 表可通过 migration drop

---

## Sprint 划分

```
Sprint 1 (M2+M5): 结算流程修复 + 清理无效模块
Sprint 2 (M4):    管理后台拆分重构
Sprint 3 (M1):    飞书 Bitable 双向同步
Sprint 4 (M3):    AI 评分多字段输入增强
```

---

## 模块设计

### 模块 M2：评审会议→结算流程修复

#### 1. 职责与边界
**做什么**：接通会议关闭→自动结算→工分直接 APPROVED 的完整链路；移除独立审批步骤
**不做什么**：不修改评审会议投票逻辑；不修改退火计算逻辑
**依赖上游**：MeetingModule、SettlementModule、PointsModule

#### 2. 后端

##### 2.1 数据模型变更

| 表 | 变更 | 说明 |
|---|---|---|
| `point_records` | `poolStatus` 默认值保持 APPROVED | 代码中不再写 PROJECT_ONLY |
| `point_approval_batches` | DROP TABLE（migration） | 移除审批功能 |

##### 2.2 业务逻辑变更

**`meeting.service.ts` — `closeMeeting()` 尾部追加事件发射**：
```
// 现有逻辑不变（set status='closed', closedAt, participantCount, save）
// 新增：
eventEmitter.emit('meeting.closed', { meetingId: meeting.id, tenantId, closedBy })
```

**新增 `settlement/meeting-settlement.listener.ts`**：
```
@OnEvent('meeting.closed')
async handleMeetingClosed({ meetingId, tenantId, closedBy }) {
  await settlementService.settleFromMeeting(meetingId, tenantId, closedBy)
}
```

**`settlement.service.ts` — `settleFromMeeting()` 修改**：
- Line ~240: 将 `PoolStatus.PROJECT_ONLY` 改为 `PoolStatus.APPROVED`
- 同理 `settleProject()` ~Line 400: 改为 `PoolStatus.APPROVED`

**`admin.controller.ts` — 移除审批端点**：
- 删除 lines 127-159：`GET/PATCH /admin/approval-batches*`

**`points.service.ts` — 移除审批方法**：
- 删除 `createApprovalBatch()`、`approveApprovalBatch()`、`rejectApprovalBatch()`、`listApprovalBatches()`、`getApprovalBatchDetail()`

**`points/entities/point-approval-batch.entity.ts` — 删除文件**

##### 2.3 关键文件清单

| 文件 | 操作 |
|---|---|
| `backend/src/meeting/meeting.service.ts` | 注入 EventEmitter，closeMeeting() 末尾发射事件 |
| `backend/src/settlement/meeting-settlement.listener.ts` | **新建**，@OnEvent 监听 |
| `backend/src/settlement/settlement.service.ts` | PROJECT_ONLY → APPROVED (2处) |
| `backend/src/settlement/settlement.module.ts` | 注册 listener，导入 MeetingModule（forwardRef） |
| `backend/src/admin/admin.controller.ts` | 删除审批相关端点 (lines 127-159) |
| `backend/src/points/points.service.ts` | 删除审批相关方法 |
| `backend/src/points/entities/point-approval-batch.entity.ts` | **删除** |
| `backend/src/database/migrations/1700000000033-*.ts` | **新建** migration: drop point_approval_batches |
| `frontend/src/pages/admin/tabs/ApprovalTab.vue` | **删除** |
| `frontend/src/services/points.ts` | 删除 approvalApi 和相关接口 (lines 17-41, 60-68) |

#### 3. 前端
- 删除 `ApprovalTab.vue`
- 从 `AdminPage.vue` 的 `allTabs` 移除 approvals 条目 (lines 33-38)
- 会议页面结束后显示结算进度反馈（可选，M2 核心不强制）

#### 4. 验证
- `cd backend && npx tsc --noEmit` 无错误
- `cd frontend && npx vue-tsc --noEmit` 无错误
- 手动测试：创建会议→投票→关闭会议→检查 point_records 表是否自动生成 poolStatus=approved 的记录

---

### 模块 M5：邀请码移除 + 死代码清理

#### 1. 职责与边界
**做什么**：彻底删除 InviteModule；删除 FeishuDeviceFlowService；删除死页面
**不做什么**：不修改注册流程核心逻辑（邮箱验证仍保留）
**依赖上游**：无

#### 2. 后端删除清单

| 文件/目录 | 操作 |
|---|---|
| `backend/src/invite/` (整个目录，8个文件) | **删除** |
| `backend/src/app.module.ts` line 9, 52 | 移除 InviteModule import |
| `backend/src/auth/auth.service.ts` lines 64, 118, 223 | 移除 inviteCode 引用 |
| `backend/src/auth/dto/register.dto.ts` lines 22-24 | 移除 inviteCode 字段 |
| `backend/src/user/user.service.ts` lines 41, 54, 62 | 移除 inviteCode 引用 |
| `backend/src/user/dto/create-user.dto.ts` line 36 | 移除 inviteCode 字段 |
| `backend/src/feishu/feishu-device-flow.service.ts` | **删除** |
| `backend/src/feishu/feishu-config.controller.ts` | 移除 device-flow endpoints |
| `backend/src/feishu/feishu.module.ts` | 移除 DeviceFlowService provider |
| `backend/src/database/migrations/1700000000034-*.ts` | **新建** migration: drop invite_codes, invite_usages |

#### 3. 前端删除清单

| 文件 | 操作 |
|---|---|
| `frontend/src/pages/admin/HrAdminPage.vue` | **删除** |
| `frontend/src/pages/admin/SuperAdminPage.vue` | **删除** |
| `frontend/src/pages/admin/tabs/InviteTab.vue` | **删除** |
| `frontend/src/pages/admin/AdminPage.vue` lines 28-32 | 移除 invites tab 条目 |
| `frontend/src/router/index.ts` lines 80-87 | 移除 admin/hr 和 admin/super 重定向 |
| `frontend/src/pages/auth/RegisterPage.vue` lines 22, 117, 334 | 移除 inviteCode 字段 |
| `frontend/src/services/auth.ts` | 移除 inviteCode 字段 |
| `frontend/src/services/admin.ts` lines 16-54 | 移除 invite 相关接口 |

#### 4. 验证
- `cd backend && npx tsc --noEmit` 无错误
- `cd frontend && npx vue-tsc --noEmit` 无错误
- 注册流程正常（无 inviteCode 字段）

---

### 模块 M4：管理后台拆分重构

#### 1. 职责与边界
**做什么**：将飞书集成和 AI 配置提取为独立页面；修复侧边栏权限闪现
**不做什么**：不修改飞书/AI 配置的功能逻辑
**依赖上游**：M5 完成后（邀请码 Tab 已移除）

#### 2. 前端

##### 新增页面

| 路由 | 页面文件 | 权限 |
|---|---|---|
| `/feishu-config` | `pages/feishu/FeishuConfigPage.vue` | `feishu:manage` |
| `/ai-config` | `pages/ai-config/AiConfigPage.vue` | `config:update` |

##### `FeishuConfigPage.vue`
- 包装 `FeishuConfigTab.vue` 的内容到独立页面布局（标题 + 容器）
- 或直接将 `FeishuConfigTab.vue` 重命名移动，添加页面级 layout wrapper

##### `AiConfigPage.vue`
- 同上，包装 `AiConfigTab.vue` 内容

##### `AdminPage.vue` 变更
- 从 `allTabs` 移除 `feishu` 和 `ai-config` 条目
- 最终保留 Tab：用户管理、权限矩阵、部门管理、审计日志（通用管理）+ super_admin: 租户管理、全局配置、运营数据、公示区设置

##### `MainLayout.vue` 变更
- 新增侧边栏条目「飞书集成」（需 `feishu:manage`）和「AI 配置」（需 `config:update`）
- 修复闪现 bug：`isAdminVisible` 加 `permissionStore.loaded &&` 前置条件

##### `router/index.ts` 变更
- 添加 `/feishu-config` 和 `/ai-config` 路由（MainLayout 子路由）
- 删除 `admin/hr` 和 `admin/super` 重定向

##### 关键文件

| 文件 | 操作 |
|---|---|
| `frontend/src/pages/feishu/FeishuConfigPage.vue` | **新建**，包装 FeishuConfigTab |
| `frontend/src/pages/ai-config/AiConfigPage.vue` | **新建**，包装 AiConfigTab |
| `frontend/src/pages/admin/AdminPage.vue` | 移除 feishu + ai-config tab 条目 |
| `frontend/src/layouts/MainLayout.vue` | 新增侧边栏条目 + 修复闪现 |
| `frontend/src/router/index.ts` | 新增路由 + 清理死路由 |

#### 3. 验证
- `cd frontend && npx vue-tsc --noEmit` 无错误
- 各角色登录后侧边栏显示正确
- 飞书集成页和 AI 配置页独立可访问

---

### 模块 M1：飞书 Bitable 双向同步

#### 1. 职责与边界
**做什么**：项目绑定飞书表、Webhook 实时同步、结算后回写最终工分
**不做什么**：不修改飞书 OAuth/通讯录同步逻辑；不替代飞书做任务日常管理
**依赖上游**：M2（结算流程必须跑通）、FeishuModule（复用 client/webhook）

#### 2. 后端

##### 2.1 数据模型

| 表名 | 关键字段 | 说明 | 共享 |
|---|---|---|---|
| `feishu_bitable_bindings` (新) | id, tenantId, projectId(unique), appToken, tableId, fieldMapping(jsonb), writebackFieldId, lastSyncAt, syncStatus, createdAt | 项目↔飞书表绑定 | 否 |
| `feishu_bitable_records` (新) | id, bindingId, feishuRecordId(unique per binding), taskId, lastEventId, lastSyncAt | 行级映射防重复 | 否 |
| `tasks` (改) | 新增 feishuRecordId (varchar, nullable, indexed) | 关联飞书行 | 是 |

`fieldMapping` JSONB 结构：
```json
{
  "title": "fld_xxx",        // 飞书字段 ID → 平台字段
  "assignees": "fld_yyy",
  "status": "fld_zzz",
  "description": "fld_aaa",
  "attachments": "fld_bbb"
}
```

##### 2.2 API 规格

#### 获取飞书表字段列表
- **方法+路径**：`POST /projects/:projectId/bitable/fetch-fields`
- **认证**：JWT（project lead）
- **请求体**：`{ "appToken": "string", "tableId": "string" }`
- **成功响应 200**：`{ "fields": [{ "fieldId": "string", "fieldName": "string", "type": "number" }] }`
- **错误**：401 未认证，403 无权限，502 飞书 API 调用失败

#### 保存绑定配置
- **方法+路径**：`POST /projects/:projectId/bitable/bindng`
- **认证**：JWT（project lead）
- **请求体**：`{ "appToken": "string", "tableId": "string", "fieldMapping": {...}, "writebackFieldId": "string" }`
- **成功响应 201**：`{ "id": "uuid", "syncStatus": "pending" }`
- **副作用**：自动入队首次全量同步任务

#### 获取绑定状态
- **方法+路径**：`GET /projects/:projectId/bitable/binding`
- **认证**：JWT
- **成功响应 200**：`{ binding | null, lastSyncAt, syncStatus, taskCount }`

#### 手动触发同步
- **方法+路径**：`POST /projects/:projectId/bitable/sync`
- **认证**：JWT（project lead）
- **成功响应 202**：`{ "jobId": "string", "message": "同步任务已创建" }`

#### 解除绑定
- **方法+路径**：`DELETE /projects/:projectId/bitable/binding`
- **认证**：JWT（project lead）
- **成功响应 204**

##### 2.3 业务逻辑

**全量同步（Bull Processor）**：
```
1. 读取 binding 配置
2. 通过 feishuClientService.getClient(tenantId) 获取 SDK client
3. client.bitable.appTableRecord.listWithIterator({ path: { app_token, table_id } })
4. for await (const page of iterator):
   a. 对每条 record，根据 fieldMapping 解析字段
   b. 查找或创建 feishu_bitable_records 映射
   c. 查找或创建 task（通过 feishuRecordId 匹配）
   d. 多负责人字段 → 解析为 TaskContribution 记录
5. 更新 binding.lastSyncAt 和 syncStatus
```

**Webhook 增量同步**：
```
1. FeishuWebhookListener 收到 feishu.webhook 事件
2. 过滤 eventType: 'drive.file.bitable_record_changed_v1' 或类似
3. 提取 record_id、table_id，匹配 binding
4. 拉取单条 record 最新数据，更新对应 task
```

**结算后回写**：
```
1. MeetingSettlementListener 结算完成后，发射 'settlement.completed' 事件
2. BitableWritebackListener 监听，检查项目是否有 binding
3. 对每个已结算的 task，如果有 feishuRecordId：
   a. client.bitable.appTableRecord.update({ 
        path: { app_token, table_id, record_id },
        data: { fields: { [writebackFieldId]: finalPoints } }
      })
```

##### 新建文件清单

| 文件 | 职责 |
|---|---|
| `backend/src/feishu/entities/feishu-bitable-binding.entity.ts` | 绑定关系实体 |
| `backend/src/feishu/entities/feishu-bitable-record.entity.ts` | 行映射实体 |
| `backend/src/feishu/feishu-bitable.controller.ts` | 绑定配置 API |
| `backend/src/feishu/feishu-bitable-sync.service.ts` | 同步核心逻辑 |
| `backend/src/feishu/feishu-bitable-sync.processor.ts` | Bull 队列处理器 |
| `backend/src/feishu/feishu-webhook.listener.ts` | 统一 Webhook 事件监听器 |
| `backend/src/feishu/feishu-bitable-writeback.listener.ts` | 结算完成→回写飞书 |
| `backend/src/database/migrations/1700000000035-*.ts` | 建表 migration |
| `frontend/src/pages/project/tabs/BitableBindingTab.vue` | 项目设置中的绑定 UI |
| `frontend/src/services/bitable.ts` | 前端 API 调用封装 |

#### 3. 前端

##### 项目设置页新增「飞书表格」Tab
```
BitableBindingTab
├── ConnectionForm (appToken + tableId 输入)
├── FieldMappingTable (飞书字段 ↔ 平台字段下拉映射)
├── WritebackConfig (选择回写列)
├── SyncStatus (最后同步时间 + 状态 + 手动同步按钮)
└── UnbindButton
```

| 状态 | 显示内容 |
|---|---|
| loading | Spinner + "正在获取飞书表字段..." |
| empty | "尚未绑定飞书表格" + 配置表单 |
| error | 错误信息 + "飞书 API 连接失败，请检查 App Token" |
| normal | 已绑定状态 + 同步信息 + 字段映射展示 |

#### 4. 外部资源依赖

| 资源 | 具体需求 | 用途 | 必须 |
|---|---|---|---|
| 飞书 Bitable API | `bitable:app` + `bitable:app:readonly` 权限 | 读写多维表格 | 是 |
| `@larksuiteoapi/node-sdk` | ^1.60.0（已安装） | SDK 调用 | 是 |

#### 5. 验证
- `cd backend && npx tsc --noEmit` 无错误
- 绑定飞书表 → 首次全量同步 → 平台任务表出现对应数据
- 飞书表修改一行 → Webhook 触发 → 平台同步更新
- 评审会议结束 → 结算 → 最终工分回写飞书表

---

### 模块 M3：AI 评分多字段输入增强

#### 1. 职责与边界
**做什么**：扩展 AI 评审 Prompt 输入源，支持工作说明+附件+commit diff
**不做什么**：不修改三维评分维度；不修改三次调用取均值机制
**依赖上游**：SubmissionModule、AiModule

#### 2. 后端

##### 2.1 新增依赖
```json
"pdf-parse": "^1.1.1",
"mammoth": "^1.8.0"
```

##### 2.2 业务逻辑

**`ai.service.ts` — `reviewSubmission()` 改造**：
```
1. 获取 submission 及其 task
2. 构建评分上下文：
   a. description = submission.metadata.description (文本)
   b. 如有 attachments:
      - 遍历 uploadIds，读取文件
      - PDF → pdf-parse 提取文本（截断 3000 tokens）
      - DOCX → mammoth 提取文本（截断 3000 tokens）
   c. 如有 commitHash + repoUrl:
      - 调用 GitHub API / git diff 获取变更摘要（前 200 行）
   d. 拼接所有上下文为 contextText
3. 构建 Prompt：原有三维评分模板 + contextText 作为「工作成果」输入
4. 三次调用取均值（不变）
```

**新建 `ai/text-extractor.service.ts`**：
```
extractPdfText(buffer: Buffer): Promise<string>  // pdf-parse, 截断 3000 tokens
extractDocxText(buffer: Buffer): Promise<string>  // mammoth, 截断 3000 tokens
```

##### 关键文件

| 文件 | 操作 |
|---|---|
| `backend/src/ai/ai.service.ts` | 修改 reviewSubmission，拼接多字段上下文 |
| `backend/src/ai/text-extractor.service.ts` | **新建**，PDF/DOCX 文本提取 |
| `backend/src/ai/ai.module.ts` | 注册 TextExtractorService |

#### 3. 验证
- 提交含附件的任务 → AI 评分 Prompt 包含附件文本内容
- 提交含 commit hash 的任务 → AI 评分 Prompt 包含 diff 摘要

---

## 执行任务清单

### 阶段 1：Sprint 1 — 结算流程修复 (M2)

- [ ] T1. 注入 EventEmitter 到 MeetingService，closeMeeting() 末尾发射 meeting.closed 事件
  - 文件：`backend/src/meeting/meeting.service.ts`
  - 变更：constructor 注入 EventEmitter2；closeMeeting() line ~208 后添加 `this.eventEmitter.emit('meeting.closed', { meetingId, tenantId, closedBy })`
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：无

- [ ] T2. 创建 MeetingSettlementListener，监听 meeting.closed 事件触发结算
  - 文件：`backend/src/settlement/meeting-settlement.listener.ts`（新建）
  - 变更：`@Injectable()` class，注入 SettlementService，`@OnEvent('meeting.closed')` 调用 `settleFromMeeting(meetingId, tenantId, closedBy)`；try/catch 记录错误日志
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T1

- [ ] T3. 注册 listener 到 SettlementModule
  - 文件：`backend/src/settlement/settlement.module.ts`
  - 变更：providers 添加 MeetingSettlementListener；imports 确保有 EventEmitterModule
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T2

- [ ] T4. 修改 settleFromMeeting 和 settleProject 的 poolStatus 为 APPROVED
  - 文件：`backend/src/settlement/settlement.service.ts`
  - 变更：所有 `PoolStatus.PROJECT_ONLY` 改为 `PoolStatus.APPROVED`（约 2 处）
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：无

- [ ] T5. 移除审批相关后端代码
  - 文件：`backend/src/admin/admin.controller.ts`（删除 approval-batches 端点 lines 127-159）、`backend/src/points/points.service.ts`（删除审批方法）、`backend/src/points/entities/point-approval-batch.entity.ts`（删除文件）
  - 变更：删除审批端点、审批服务方法、审批实体；从 points.module.ts 的 TypeOrmModule.forFeature 移除 PointApprovalBatch
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T4

- [ ] T6. 创建 migration 删除 point_approval_batches 表
  - 文件：`backend/src/database/migrations/1700000000033-DropApprovalBatches.ts`（新建）
  - 变更：`up(): DROP TABLE IF EXISTS point_approval_batches`；`down(): 重建表`
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T5

- [ ] T7. 移除审批相关前端代码
  - 文件：`frontend/src/pages/admin/tabs/ApprovalTab.vue`（删除）、`frontend/src/pages/admin/AdminPage.vue`（移除 approvals tab 条目 lines 33-38）、`frontend/src/services/points.ts`（删除 approvalApi + 审批接口 lines 17-41, 60-68）
  - 验证：`cd frontend && npx vue-tsc --noEmit`
  - 预期：编译无错误
  - 前置：T5

### 阶段 2：Sprint 1 — 邀请码移除 + 死代码清理 (M5)

- [ ] T8. 删除 InviteModule 后端全部文件
  - 文件：`backend/src/invite/`（删除整个目录）、`backend/src/app.module.ts`（移除 InviteModule import line 9 和 imports 数组 line 52）
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：无

- [ ] T9. 清理 auth/user 模块中的 inviteCode 引用
  - 文件：`backend/src/auth/auth.service.ts`（删除 lines 64, 118, 223 的 inviteCode）、`backend/src/auth/dto/register.dto.ts`（删除 lines 22-24）、`backend/src/user/user.service.ts`（删除 lines 41, 54, 62）、`backend/src/user/dto/create-user.dto.ts`（删除 line 36）
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T8

- [ ] T10. 创建 migration 删除 invite 表
  - 文件：`backend/src/database/migrations/1700000000034-DropInviteTables.ts`（新建）
  - 变更：`up(): DROP TABLE IF EXISTS invite_usages; DROP TABLE IF EXISTS invite_codes`
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T9

- [ ] T11. 删除 FeishuDeviceFlowService
  - 文件：`backend/src/feishu/feishu-device-flow.service.ts`（删除）、`backend/src/feishu/feishu.module.ts`（移除 provider）、`backend/src/feishu/feishu-config.controller.ts`（移除 device-flow 端点）
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：无

- [ ] T12. 清理前端邀请码 + 死页面
  - 文件：删除 `InviteTab.vue`、`HrAdminPage.vue`、`SuperAdminPage.vue`；修改 `AdminPage.vue`（移除 invites tab）、`router/index.ts`（移除 admin/hr、admin/super 重定向）、`RegisterPage.vue`（移除 inviteCode 字段 lines 22, 117, 334）、`services/auth.ts`（移除 inviteCode）、`services/admin.ts`（移除 invite 相关 lines 16-54）
  - 验证：`cd frontend && npx vue-tsc --noEmit`
  - 预期：编译无错误
  - 前置：T8

### 阶段 3：Sprint 2 — 管理后台拆分重构 (M4)

- [ ] T13. 创建飞书集成独立页面
  - 文件：`frontend/src/pages/feishu/FeishuConfigPage.vue`（新建）
  - 变更：页面级 wrapper 组件，导入并渲染 FeishuConfigTab 内容（可直接移动 Tab 内容+添加 page header）
  - 验证：`cd frontend && npx vue-tsc --noEmit`
  - 预期：编译无错误
  - 前置：T12

- [ ] T14. 创建 AI 配置独立页面
  - 文件：`frontend/src/pages/ai-config/AiConfigPage.vue`（新建）
  - 变更：同 T13 模式，包装 AiConfigTab 内容
  - 验证：`cd frontend && npx vue-tsc --noEmit`
  - 预期：编译无错误
  - 前置：T12

- [ ] T15. 更新路由和侧边栏
  - 文件：`frontend/src/router/index.ts`（添加 /feishu-config 和 /ai-config 路由）、`frontend/src/layouts/MainLayout.vue`（添加侧边栏条目 + 修复权限闪现 bug）、`frontend/src/pages/admin/AdminPage.vue`（移除 feishu 和 ai-config tab 条目）
  - 变更：路由添加两个 MainLayout 子路由；侧边栏 navItems 添加权限控制的条目；isAdminVisible 添加 `permissionStore.loaded &&` 前置条件
  - 验证：`cd frontend && npx vue-tsc --noEmit`
  - 预期：编译无错误；侧边栏不再闪现
  - 前置：T13, T14

### 阶段 4：Sprint 3 — 飞书 Bitable 双向同步 (M1)

- [ ] T16. 创建 Bitable 绑定实体和 migration
  - 文件：`backend/src/feishu/entities/feishu-bitable-binding.entity.ts`（新建）、`backend/src/feishu/entities/feishu-bitable-record.entity.ts`（新建）、`backend/src/database/migrations/1700000000035-CreateBitableBindings.ts`（新建）
  - 变更：两个实体定义 + migration 建表 + tasks 表添加 feishuRecordId 列
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T6（migration 编号连续）

- [ ] T17. 添加 Bull 队列常量和处理器
  - 文件：`backend/src/queue/queue.constants.ts`（添加 FEISHU_BITABLE_SYNC）、`backend/src/feishu/feishu-bitable-sync.processor.ts`（新建）
  - 变更：注册队列，创建 `@Processor` 类处理全量同步 job
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T16

- [ ] T18. 创建 Bitable 同步核心服务
  - 文件：`backend/src/feishu/feishu-bitable-sync.service.ts`（新建）
  - 变更：实现 `fullSync(bindingId)`（async iterator 遍历飞书表行→创建/更新 task）、`syncSingleRecord(bindingId, recordId)`（增量同步单条）、`writebackPoints(projectId, taskResults[])` （结算后回写）
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T16, T17

- [ ] T19. 创建 Bitable 配置 API 控制器
  - 文件：`backend/src/feishu/feishu-bitable.controller.ts`（新建）
  - 变更：实现 5 个端点：fetch-fields、binding（POST/GET/DELETE）、sync
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T18

- [ ] T20. 创建统一 Webhook 事件监听器
  - 文件：`backend/src/feishu/feishu-webhook.listener.ts`（新建）
  - 变更：`@OnEvent('feishu.webhook')` 监听，路由事件到 FeishuSyncService.processWebhookEvent（通讯录）和 FeishuBitableSyncService.syncSingleRecord（Bitable 变更）
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T18

- [ ] T21. 创建结算→回写监听器
  - 文件：`backend/src/feishu/feishu-bitable-writeback.listener.ts`（新建）
  - 变更：`@OnEvent('settlement.completed')` 监听，检查项目是否有 Bitable 绑定，如有则调用 writebackPoints
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T18, T2（settlement 事件链）

- [ ] T22. 更新 FeishuModule 注册新组件
  - 文件：`backend/src/feishu/feishu.module.ts`
  - 变更：TypeOrmModule.forFeature 添加两个新实体；BullModule 注册新队列；providers 添加新 service/processor/listener；controllers 添加新 controller
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T16-T21

- [ ] T23. 结算服务发射 settlement.completed 事件
  - 文件：`backend/src/settlement/settlement.service.ts`
  - 变更：settleFromMeeting() 和 settleProject() 末尾发射 `this.eventEmitter.emit('settlement.completed', { projectId, taskResults, settlementId })`
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T4

- [ ] T24. 创建前端 Bitable 绑定 UI
  - 文件：`frontend/src/pages/project/tabs/BitableBindingTab.vue`（新建）、`frontend/src/services/bitable.ts`（新建）
  - 变更：绑定配置表单（appToken + tableId 输入）、字段映射表格、同步状态显示、手动同步按钮
  - 验证：`cd frontend && npx vue-tsc --noEmit`
  - 预期：编译无错误
  - 前置：T19

- [ ] T25. 将 Bitable Tab 集成到项目详情页
  - 文件：`frontend/src/pages/project/ProjectDetailPage.vue`
  - 变更：项目设置区域（或新 Tab）添加 BitableBindingTab 组件
  - 验证：`cd frontend && npx vue-tsc --noEmit`
  - 预期：编译无错误
  - 前置：T24

### 阶段 5：Sprint 4 — AI 评分多字段增强 (M3)

- [ ] T26. 安装文本提取依赖
  - 文件：`backend/package.json`
  - 变更：`pnpm add pdf-parse mammoth`（在 backend 目录下）
  - 验证：`cd backend && pnpm list pdf-parse mammoth`
  - 预期：两个包已安装
  - 前置：无

- [ ] T27. 创建 TextExtractorService
  - 文件：`backend/src/ai/text-extractor.service.ts`（新建）
  - 变更：实现 `extractPdfText(buffer)` 和 `extractDocxText(buffer)` ，每个截断 3000 tokens
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T26

- [ ] T28. 改造 AiService 支持多字段输入
  - 文件：`backend/src/ai/ai.service.ts`
  - 变更：reviewSubmission 方法增加多字段上下文构建：读取 submission metadata 中的 description + uploadIds（调用 TextExtractorService 提取附件文本）+ commitHash（构建 diff 摘要）；拼接为 contextText 传入 Prompt
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T27

- [ ] T29. 注册 TextExtractorService 到 AiModule
  - 文件：`backend/src/ai/ai.module.ts`
  - 变更：providers 添加 TextExtractorService
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：编译无错误
  - 前置：T27

### 阶段 6：集成验证

- [ ] T30. 后端完整编译验证
  - 验证：`cd backend && npx tsc --noEmit`
  - 预期：零错误

- [ ] T31. 前端完整编译验证
  - 验证：`cd frontend && npx vue-tsc --noEmit`
  - 预期：零错误

- [ ] T32. 本地 Docker 构建验证
  - 验证：`docker compose -f docker-compose.prod.yml build`
  - 预期：构建成功

---

## 质量保障策略

- **类型检查**：每个任务完成后 `tsc --noEmit` / `vue-tsc --noEmit`
- **Migration 安全**：所有 migration 有 up() 和 down()，先在本地验证
- **渐进式部署**：Sprint 1（bug fix）可独立部署；Sprint 2-4 按序部署

## 风险与应对

| 风险 | 应对 |
|---|---|
| 飞书 Bitable API 权限不足 | Sprint 3 开始前确认飞书 App 已添加 bitable:app 权限 |
| Webhook 事件类型不匹配 | 先用 lark-cli 手动触发事件，确认 eventType 字符串 |
| 循环依赖 | 用 EventEmitter 解耦模块，forwardRef 兜底 |
| pdf-parse Docker 构建失败 | 使用纯 JS 版本（pdf-parse 无原生依赖） |

## 验证方案

1. **Sprint 1 验证**：创建会议→投票→关闭→检查 point_records 有 APPROVED 记录
2. **Sprint 2 验证**：各角色登录后侧边栏正确；飞书集成/AI配置独立页可访问
3. **Sprint 3 验证**：绑定飞书表→全量同步→飞书修改行→平台更新→结算→工分回写飞书
4. **Sprint 4 验证**：提交含附件/commit 的任务→AI Prompt 包含完整上下文
