# PRD: 飞书集成配置向导化改造

## 1. 目标

将飞书集成配置从平铺式表单改造为**分步引导向导 + 半自动化配置**，利用飞书设备流 API 实现一键创建应用，利用飞书 Application API 自动配置 Webhook/事件订阅/通讯录范围，同时新建 `feishu:manage` 独立权限将配置入口收归超管。

## 2. 约束与边界

**硬性条件**：
- 设备流应用创建使用飞书未公开 API（`accounts.feishu.cn/oauth/v1/app/registration`），必须实现静默降级到手动模式
- 权限 scope 添加和应用发布无法通过 API 完成，仍需用户在飞书控制台手动操作
- 已有飞书配置数据（feishu_configs 表）必须向后兼容，不丢失

**不做**：
- 不做权限 scope 的自动申请（飞书无此 API）
- 不做应用版本的自动发布（飞书无此 API）
- 不改变现有的 OAuth 登录流程和通讯录同步逻辑

## 3. 技术栈

| 层面 | 选型 |
|------|------|
| 前端 | Vue 3 + TypeScript（现有） |
| 后端 | NestJS + TypeScript（现有） |
| 飞书 SDK | @larksuiteoapi/node-sdk（现有） |
| 飞书设备流 | 直接 HTTP 调用 `accounts.feishu.cn`（无 SDK 封装） |
| 飞书 Application API | `PATCH /application/v6/applications/:app_id`、`GET /application/v6/scopes` |
| 权限系统 | 现有 CASL + DB 驱动 RBAC |

## 4. 用户操作动线

### 超管 — 首次配置

1. 进入管理后台 → 看到「飞书集成」Tab（仅 `feishu:manage` 权限可见）
2. 进入向导步骤 ①「创建/连接飞书应用」
   - 点击「一键创建应用」→ 弹出模态框展示授权链接（可能含二维码）→ 用户在飞书浏览器中扫码/点击批准 → App ID + Secret 自动回填并保存 → 自动执行测试连接
   - 或点击「手动输入凭据」→ 展开 App ID + Secret 输入框 → 填写并保存 → 测试连接
   - 设备流失败（API 不可用/超时）→ 自动切换到手动输入界面，提示"一键创建暂时不可用，请手动输入"
3. 步骤 ②「配置权限」
   - 展示所需权限列表，每项有「复制」按钮
   - 「一键复制全部权限名称」按钮
   - 「打开飞书控制台权限页 ↗」外链按钮
   - 「检测权限状态」按钮 → 调用 `GET /application/v6/scopes` → 逐项显示 ✅已授权 / ❌未授权
4. 步骤 ③「发布应用」
   - 提示文案："添加权限后需要发布新版本才能生效"
   - 「打开飞书应用发布页 ↗」外链按钮
   - 可选「检测权限状态」验证发布是否生效
5. 步骤 ④「自动配置」
   - 「开始自动配置」按钮 → 依次执行：
     - 设置 Webhook URL → ✅ / ❌
     - 配置事件订阅（contact.user.created_v3 / updated_v3 / deleted_v3、contact.department.created_v3 / updated_v3 / deleted_v3）→ ✅ / ❌
     - 设置通讯录范围为全员 → ✅ / ❌
   - 全部成功 → 进入下一步；部分失败 → 显示失败项 + 重试按钮
6. 步骤 ⑤「角色映射」
   - 飞书职位 → 平台角色 映射表（与现有功能一致）
   - 添加/删除映射行
7. 步骤 ⑥「同步通讯录」
   - 「开始全量同步」按钮
   - 同步日志列表（与现有功能一致）
8. 向导完成 → 自动切换为仪表盘模式

### 超管 — 已配置状态

进入飞书集成 Tab → 看到仪表盘视图：
- **连接状态卡片**：App ID、连接状态（✅已连接/❌异常）、上次同步时间
- **权限状态卡片**：已授权 scope 列表（绿色）、未授权 scope（红色），「刷新」按钮
- **Webhook 配置卡片**：URL、事件订阅数量、Verify Token（可复制）
- **角色映射卡片**：当前映射列表，可编辑
- **通讯录同步卡片**：部门数/成员数、上次同步状态/时间、「全量同步」按钮、「查看日志」
- **操作区**：「重新配置」（回到向导模式）

### 非超管

不可见飞书集成 Tab（无 `feishu:manage` 权限），不感知任何变化。

## 5. 模块设计

### 模块 A: 设备流应用创建

- **职责**：通过飞书设备流 API 实现一键创建飞书自建应用并自动获取凭据
- **核心功能**：
  1. 发起设备流（begin）→ 获取 verification_uri + device_code
  2. 轮询设备流结果（poll）→ 等待用户授权 → 获取 client_id + client_secret
  3. 自动保存凭据到 feishu_configs 表
  4. 失败/超时静默降级到手动输入
- **页面/交互设计**：
  - 「一键创建应用」按钮 → 点击后弹出模态框
  - 模态框内容：授权链接（可点击）+ 轮询状态指示器（加载动画）
  - 超时（5分钟无响应）→ 自动关闭模态框 + toast 提示切换手动模式
  - 成功 → 模态框自动关闭 + App ID/Secret 字段自动填入 + 绿色成功提示
  - API 不可用 → 「一键创建」按钮变灰 + 旁边提示"暂不可用"+ 手动输入区域自动展开
- **关键业务规则**：
  - 设备流 API 端点：`POST https://accounts.feishu.cn/oauth/v1/app/registration`，begin 获取链接，poll 轮询结果
  - 轮询间隔 5 秒，最大超时 5 分钟
  - 获取到的 client_secret 使用 AES-256-GCM 加密后存储（复用现有加密逻辑）

### 模块 B: 自动配置引擎

- **职责**：通过飞书 Application API 自动配置 Webhook URL、事件订阅、通讯录范围
- **核心功能**：
  1. 设置 Webhook URL 和回调类型 → `PATCH /application/v6/applications/:app_id`
  2. 配置事件订阅列表 → 同上 `subscribed_callbacks` 字段
  3. 设置通讯录范围为全员 → `PATCH /application/v6/applications/:app_id/contacts_range`
  4. 检测权限授权状态 → `GET /application/v6/scopes`
- **页面/交互设计**：
  - 「开始自动配置」按钮 → 依次执行三项配置
  - 每项实时显示状态：⏳进行中 → ✅成功 / ❌失败（附错误原因）
  - 部分失败 → 「重试失败项」按钮
  - 全部成功 → 绿色完成提示 + 自动进入下一步
  - 「检测权限状态」→ 调用 GET scopes → 返回每个 scope 的 grant_status
- **关键业务规则**：
  - 自动配置需要有效的 tenant_access_token（通过已保存的 App ID/Secret 获取）
  - 如果应用未发布或权限未授权，PATCH 调用会返回特定错误码 → 提示用户先完成步骤②③
  - 事件订阅列表固定为：`contact.user.created_v3`、`contact.user.updated_v3`、`contact.user.deleted_v3`、`contact.department.created_v3`、`contact.department.updated_v3`、`contact.department.deleted_v3`
  - Webhook URL 格式：`https://{域名}/api/feishu-webhook/{tenantId}`
  - 通讯录范围设置为 `contacts_range_type: "all"`

### 模块 C: 向导器 UI

- **职责**：将飞书配置流程组织为分步向导（首次）和仪表盘（已配置）两种视图
- **核心功能**：
  1. 检测当前配置状态，决定显示向导或仪表盘
  2. 向导模式：6 步 Stepper，每步可前后导航
  3. 仪表盘模式：折叠式状态卡片，可展开编辑
  4. 「重新配置」从仪表盘切回向导
- **页面/交互设计**：
  - **向导模式**：顶部 Stepper 指示器（当前步骤高亮 + 已完成步骤绿色勾）→ 步骤内容区 → 底部上一步/下一步按钮
  - **仪表盘模式**：垂直排列的 glass-card 卡片组，每张卡片标题 + 状态标签 + 可展开内容
  - **空状态**（无配置）：直接进入向导步骤 ①
  - **加载中**：骨架屏（与现有管理后台一致）
  - **「重新配置」**：确认弹窗 → 回到向导模式（不删除数据）
- **关键业务规则**：
  - 判断已配置 = feishu_configs 表存在该 tenantId 的记录且 appId 非空
  - 步骤可跳转但不可跳过步骤①（必须先有凭据）
  - 角色映射和同步日志在仪表盘模式下始终可见（不需展开）

### 模块 D: 权限控制

- **职责**：新建 `feishu` 资源和 `manage` 动作，将飞书配置入口收归超管
- **核心功能**：
  1. 数据库迁移：新增 `feishu:manage` 权限到 role_permissions
  2. 给 super_admin 角色自动分配 `feishu:manage`
  3. 后端 Controller 权限从 `config:manage` 改为 `feishu:manage`
  4. 前端 Tab 权限从 `config:update` 改为 `feishu:manage`
- **关键业务规则**：
  - `feishu:manage` 是新增的独立权限，不影响现有 `config:*` 权限
  - 超管可在权限矩阵中将 `feishu:manage` 分配给其他角色
  - 现有拥有 `config:manage` 的用户不自动获得 `feishu:manage`（只有 super_admin 角色默认拥有）

## 6. 数据库设计

无新增表。变更如下：

| 表名 | 变更 | 说明 |
|------|------|------|
| role_permissions | INSERT | 新增资源 `feishu`、动作 `manage`，分配给 super_admin |

现有 `feishu_configs`、`feishu_role_mappings`、`feishu_sync_logs` 表结构不变。

## 7. 模块间关系

```
FeishuConfigTab.vue (向导器 UI)
  ├── 调用 feishu-config API（现有 + 新增端点）
  │     ├── POST /feishu-config/device-flow/begin  → 模块 A
  │     ├── POST /feishu-config/device-flow/poll   → 模块 A
  │     ├── POST /feishu-config/auto-configure     → 模块 B
  │     ├── GET  /feishu-config/check-scopes       → 模块 B
  │     ├── GET/POST /feishu-config (现有)         → 配置 CRUD
  │     ├── GET/POST/DELETE /feishu-config/role-mappings (现有)
  │     └── POST /feishu-config/sync (现有)
  └── 权限门槛: feishu:manage                      → 模块 D

FeishuConfigController
  ├── @CheckPolicies('feishu', 'manage')           → 模块 D
  ├── FeishuClientService (现有)                    → SDK 客户端/加密
  ├── FeishuConfigService (现有 + 扩展)             → 配置 CRUD
  └── FeishuAutoConfigService (新增)                → 模块 B
       ├── 调用 PATCH /application/v6/applications/:app_id
       ├── 调用 PATCH /application/v6/applications/:app_id/contacts_range
       └── 调用 GET /application/v6/scopes

FeishuDeviceFlowService (新增)                      → 模块 A
  ├── 调用 POST accounts.feishu.cn/oauth/v1/app/registration
  └── FeishuConfigService → 保存获取到的凭据
```
