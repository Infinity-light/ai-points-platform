# AI 工分制协作平台 — CLAUDE.md

## 项目概述

基于"神笔"项目半年实践经验开发的独立企业级协作平台。核心问题：人工记分不公平、管理成本高、无法防止贡献固化、没有智能任务分派。目标：全流程 AI 自动化 + 公平分配 + 防贡献固化 + 项目智脑。

**生产地址**：http://points.godpenai.com
**服务器**：47.98.171.82（阿里云杭州，user: root）
**仓库**：https://github.com/Infinity-light/ai-points-platform（私有）

---

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | NestJS (TypeScript)，端口 3000（容器内）/ 4000（宿主机） |
| 前端 | Vue 3 + TypeScript + Vite，端口 80（容器内）/ 4100（宿主机）|
| 数据库 | PostgreSQL 15 |
| 缓存/队列 | Redis 7 + Bull |
| 部署 | Docker Compose，宿主机 Nginx 反代 80 → 4100 |
| CI/CD | GitHub Actions (server-build 策略，SCP 源码到服务器后在服务器构建) |

---

## 目录结构

```
ai-points-platform/
├── backend/                 # NestJS 后端
│   ├── src/
│   │   ├── auth/            # JWT 双 token、邮箱验证码注册/登录
│   │   ├── tenant/          # 租户管理（多租户 tenant_id 字段隔离）
│   │   ├── user/            # 用户、角色、权限 Guard
│   │   ├── project/         # 项目 CRUD、成员管理、退火/结算配置
│   │   ├── task/            # 任务表、状态机、CRUD
│   │   ├── ai/              # LLM API 封装、Prompt 模板、三次调用取均值
│   │   ├── submission/      # 提交记录、三种类型处理
│   │   ├── vote/            # 投票会话、加权投票计算
│   │   ├── points/          # 工分记录、退火计算、/points/my-summary API
│   │   ├── settlement/      # 结算触发、退火重算、分红事件
│   │   ├── brain/           # 智脑对话、SSE 流式输出
│   │   ├── notification/    # 站内通知
│   │   ├── invite/          # 邀请码管理
│   │   ├── admin/           # 统一管理后台 API（含用户管理、租户设置）
│   │   ├── super-admin/     # 超管 API（租户、全局配置）
│   │   ├── rbac/            # 动态角色权限（CASL + DB 驱动，替代旧 RolesGuard）
│   │   ├── audit/           # 审计日志（全局拦截器 + 查询 API）
│   │   ├── meeting/         # 实时评审会议（Socket.IO + 投票 + 结算触发）
│   │   ├── auction/         # 通用竞拍引擎（Bull 延迟任务 + 事件驱动）
│   │   ├── bulletin/        # 公示区（工分排行/账目/决策/审计，支持公开模式）
│   │   ├── upload/          # 文件上传
│   │   └── webhook/         # Git Webhook 接收
│   ├── Dockerfile           # 多阶段构建，China mirrors，bcrypt 原生编译
│   └── package.json
├── frontend/                # Vue 3 前端
│   ├── src/
│   │   ├── pages/           # 各页面（dashboard/login/projects/vote/profile...）
│   │   ├── components/      # 公共组件
│   │   ├── services/        # API 调用封装
│   │   ├── stores/          # Pinia stores
│   │   └── router/          # Vue Router
│   ├── nginx.conf           # 容器内 Nginx（SPA fallback + /api/ 反代到 backend）
│   └── Dockerfile           # 多阶段构建，China mirrors
├── docker-compose.prod.yml  # 生产 Compose（4 服务：postgres/redis/backend/frontend）
├── pnpm-workspace.yaml      # pnpm monorepo workspace
├── pnpm-lock.yaml           # 根级 lockfile（Docker build 从根目录拷贝）
└── .github/workflows/
    └── deploy.yml           # CI/CD：server-build 策略
```

---

## 架构设计

### 多租户方案

tenant_id 字段隔离（非 schema 隔离）。每张业务表有 `tenantId UUID`，通过 `TenantInterceptor` 全局注入。第一版优先开发速度，后续需要可迁移至 schema 隔离。

### 工分退火

阶梯退火，每 `cyclesPerStep` 次结算进一档，指数衰减：
```
tier = floor((currentRound - acquiredRound) / cyclesPerStep)
活跃工分 = floor(原始工分 / 3^tier)
tier >= maxSteps 时清零
```
默认配置：`cyclesPerStep=3, maxSteps=4` → 12 次结算后清零（tier 0→1→2→3→清零）。
实现在 `backend/src/points/annealing.ts`，有完整单元测试 `annealing.spec.ts`。

**Migration 014**：修复旧项目默认 `maxSteps=9`（错误）→ `4`（正确）。

### AI 评审 + 评审会议

三维度评分：调查(0-5) / 规划(0-5) / 执行(0-5)，总分15。每次提交触发3次 LLM 调用：
- 成功调用结果取均值
- 部分失败：跳过失败结果，用成功结果均值
- 全部失败：抛出异常，任务重新入队
- Prompt 不传提交人姓名以去主观化

**评审会议（v2）**：AI 评分后进入 `PENDING_REVIEW` 状态，由项目负责人开启实时评审会议（Socket.IO），团队逐条审核：
- 认可 AI 评分 = 投出 AI 原始总分
- 不认可 = 投出自定义总分（无上限，支持 Bonus）
- 最终分数 = 所有参会者投分的中位数
- 多人任务：按百分比分配（不要求合计 100%）
- 会议结束自动触发结算

**结算积分公式**：`finalPoints = max(1, round(estimatedPoints × finalScore/15))`，finalScore 来自评审会议中位数。

### 动态角色权限（RBAC）

替代旧的硬编码 `Role` 枚举，使用 CASL + 数据库驱动：
- `roles` 表：租户级（super_admin/hr_admin/project_lead/employee）+ 项目级（lead/member）+ 自定义角色
- `role_permissions` 表：资源×动作（如 users:read, tasks:create, points:approve）
- `PoliciesGuard` + `@CheckPolicies(resource, action)` 替代旧 `RolesGuard` + `@Roles()`
- JWT 只存 userId，权限每次请求从 DB 加载
- 超级管理员可在管理后台创建自定义角色并配置权限矩阵

### 通用竞拍引擎

独立模块，活跃工分竞拍：
- 支持任务认领竞拍、奖励竞拍、自定义竞拍
- Bull 延迟任务自动开奖
- EventEmitter 事件驱动结果回写（如自动分配任务给赢家）
- 单人任务第二人认领时自动触发竞拍

### CI/CD — server-build 策略

**为什么选 server-build 而不是 GHCR pull**：阿里云杭州拉取 GHCR 镜像受国际带宽限速，不可用。改为：
1. `git archive HEAD -o source.tar.gz` 打包源码（约 600KB）
2. SCP 到服务器 `/tmp/deploy/`
3. SSH 在服务器上 `docker build`（使用阿里云 Alpine 镜像 + npmmirror.com）
4. `docker compose up --pull never`（镜像已本地构建，不拉取）
5. 运行 TypeORM 迁移（自动）
6. 配置 Nginx 反代 + 申请/续期 Let's Encrypt SSL（幂等，base64 编码规避 YAML heredoc 问题）

### Dockerfile 关键设计

- **Alpine 镜像**：`sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories`
- **pnpm 镜像**：`--registry https://registry.npmmirror.com`
- **Docker build context**：必须用仓库根目录（`.`），因为 `pnpm-lock.yaml` 在根级
- **bcrypt 原生编译**：生产阶段安装 `python3 make g++`，并设置 `pnpm.onlyBuiltDependencies` 允许 bcrypt/msgpackr-extract 执行 build scripts（pnpm v10 默认禁止）
- **husky 冲突**：生产阶段安装前删除 `package.json` 中的 `prepare` 脚本（husky 不在 prod deps）

---

## 核心模块说明

### auth 模块

- 注册：`POST /auth/register`，需要 `tenantSlug`、`email`、`password`、`name`，可选 `inviteCode`
- 邮箱验证：`POST /auth/verify-email`
- 登录：`POST /auth/login`，需要 `tenantSlug`、`email`、`password`，返回 JWT access + refresh token
- 刷新：`POST /auth/refresh`（需 refresh token）
- JWT access token 有效期 15m，refresh token 7d

### points 模块

- `GET /points/my-summary`（需 JWT）：返回 `{ totalPoints, activePoints, monthlyPoints }`
- `totalPoints`：该用户在当前租户下所有原始工分之和
- `activePoints`：基于各 project 当前 `settlementRound` + `annealingConfig` 计算真实退火后工分之和
- `monthlyPoints`：当月新增原始工分
- 实现注入 `ProjectRepository`，按 projectId 批量拉取配置后逐条计算

### brain 模块

- SSE 流式输出端点，LLM 对话历史持久化
- 支持文档检索、任务表操作

### super-admin 模块

- 所有接口要求 `CheckPolicies('tenants', 'read')`
- 租户 CRUD、全局配置、LLM API Key 配置

### rbac 模块

- 角色 CRUD：`GET/POST/PATCH/DELETE /rbac/roles`
- 权限管理：`GET/PUT /rbac/roles/:id/permissions`
- 角色分配：`PATCH /rbac/users/:id/tenant-role`、`PATCH /rbac/users/:id/project-role`
- 当前用户权限：`GET /rbac/my-permissions`

### audit 模块

- 全局 `AuditInterceptor` 拦截所有写操作（POST/PATCH/DELETE），异步记录到 `audit_logs` 表
- 查询：`GET /audit/logs`（分页+筛选）、`GET /audit/logs/:resource/:resourceId`（单资源历史）

### meeting 模块

- 创建：`POST /meetings`（需 votes:create 权限）
- Socket.IO Gateway：namespace `/meeting`，JWT 认证
- 事件：join/focus/vote/contribution/confirm/end
- 会议结束自动触发 `SettlementService.settleFromMeeting()`

### auction 模块

- CRUD：`POST/GET /auctions`、`POST /auctions/:id/bid`
- Bull 延迟任务 `auction-close` 自动开奖
- `TaskAuctionListener` 监听 `auction.closed` 事件，自动分配任务

### bulletin 模块

- 内部路由：`GET /bulletin/leaderboard|settlements|dividends|decisions|audit-trail`（需 JWT）
- 公开路由：`GET /public/:tenantSlug/bulletin/*`（无需 JWT，姓名脱敏）
- 排行榜数据来自 `points_snapshots` 结算快照

---

## 部署与运维

### 初次部署引导（bootstrap）

数据库为空时，需手动从后端容器执行：
```bash
# 1. 创建租户
docker exec ai_points_postgres psql -U postgres -d ai_points_platform -c \
  "INSERT INTO tenants (id, name, slug, settings, \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), 'My Team', 'my-team', '{}', NOW(), NOW());"

# 2. 创建超级管理员（bcrypt hash 必须从容器内生成，避免 shell 变量展开破坏 $2b$ 前缀）
docker exec ai_points_backend node -e "
const bcrypt = require('./node_modules/bcrypt');
const pg = require('pg');
bcrypt.hash('YourPassword', 12).then(h => {
  const client = new pg.Client({host:'postgres',user:'postgres',database:'ai_points_platform',password:process.env.DB_PASSWORD});
  client.connect().then(() => client.query(
    'INSERT INTO users (id,email,\"passwordHash\",name,role,\"isEmailVerified\",\"tenantId\",\"createdAt\",\"updatedAt\") VALUES (gen_random_uuid(),\$1,\$2,\$3,\$4,true,\$5,NOW(),NOW())',
    ['admin@my-team.com', h, 'Admin', 'super_admin', '<TENANT_ID>']
  )).then(() => { console.log('done'); client.end(); });
});"
```

> **注意**：直接用 shell 变量传 bcrypt hash 会导致 `$2b$12$` 前缀被展开为空，必须在容器内生成并写入。

### Nginx 配置

宿主机 `/etc/nginx/sites-enabled/points.godpenai.com`：
```nginx
server {
    listen 80;
    server_name points.godpenai.com;
    client_max_body_size 50m;
    location / {
        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_buffering off;
    }
}
```
> **WebSocket 支持**：`proxy_http_version 1.1` + `Upgrade` headers 支持 Socket.IO 评审会议实时通信。前端容器 nginx.conf 中有独立的 `/socket.io/` location block 转发到 backend:3000。

### Docker Compose 服务

| 服务 | 镜像 | 宿主机端口 | 容器端口 |
|------|------|-----------|---------|
| postgres | postgres:15-alpine | — | 5432 |
| redis | redis:7-alpine | — | 6379 |
| backend | ai-points-backend:latest | 4000 | 3000 |
| frontend | ai-points-frontend:latest | 4100 | 80 |

### 常用运维命令

```bash
# 查看所有容器状态
sudo docker ps

# 查看 backend 日志
sudo docker compose -f /opt/apps/ai-points-platform/docker-compose.prod.yml logs -f backend

# 手动运行 migration
sudo docker compose -f /opt/apps/ai-points-platform/docker-compose.prod.yml exec -T backend \
  node_modules/.bin/typeorm migration:run -d dist/database/data-source.js

# 重启所有服务
sudo docker compose -f /opt/apps/ai-points-platform/docker-compose.prod.yml restart
```

---

## 环境变量

后端关键环境变量（写入 `/opt/apps/ai-points-platform/.env`，由 CI 自动生成）：

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | production |
| `PORT` | 3000 |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_NAME` | PostgreSQL 连接 |
| `DB_PASSWORD` | 来自 GitHub Secret |
| `REDIS_HOST` / `REDIS_PORT` | Redis 连接 |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | JWT 签名密钥 |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | 15m / 7d |
| `LLM_API_KEY` | Claude API Key |
| `LLM_MODEL` | claude-sonnet-4-6 |
| `LLM_TEMPERATURE` | 0.3 |
| `SMTP_PASS` | 邮件发送密码 |

GitHub Secrets 需配置：`SERVER_HOST`、`SERVER_USER`、`SSH_PRIVATE_KEY`、`DB_PASSWORD`、`JWT_SECRET`、`JWT_REFRESH_SECRET`、`LLM_API_KEY`、`SMTP_PASS`

---

## 开发规范

### 提交规范

遵循 Conventional Commits：`feat:` / `fix:` / `refactor:` / `docs:`

### 本地开发

```bash
# 后端（需本地 postgres + redis）
cd backend && pnpm dev

# 前端
cd frontend && pnpm dev

# 运行测试
pnpm test
```

### 注意事项

- TypeScript 严格模式，所有新增代码必须通过 `tsc --noEmit`
- Vue 组件必须通过 `vue-tsc --noEmit`
- bcrypt hash 只能在服务端生成，不能在 CI shell 中拼接（`$` 前缀会被展开）
- pnpm workspace 要求 Docker build context 必须是仓库根目录
