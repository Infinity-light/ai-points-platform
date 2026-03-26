# AI 工分制协作平台

企业级 AI 赋能工分制协作平台。团队成员通过完成项目任务获得工分，工分随时间退火衰减，近期贡献权重更高。

---

## 核心功能

- **多租户架构** — 组织间数据完全隔离
- **项目与任务管理** — 创建项目、定义任务，全生命周期跟踪（open → claimed → submitted → AI review → vote → settled）
- **AI 智能评审** — LLM 自动从研究、规划、执行三个维度对提交成果评分
- **工分与退火** — 原始工分按获取轮次衰减，活跃工分反映当前贡献价值
- **投票确认** — 结算前通过同伴投票验证任务完成质量
- **基于角色的权限** — super_admin / hr_admin / project_lead / employee 四级权限
- **实时通知** — 基于 SSE 的通知流推送
- **邮件邀请** — 通过邮件链接邀请新成员加入

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript、Vite、Pinia、Vue Router、Tailwind CSS、Radix Vue |
| 后端 | NestJS (Node.js) + TypeScript、TypeORM |
| 数据库 | PostgreSQL 15 |
| 缓存 / 队列 | Redis 7 |
| AI | Anthropic Claude（可配置模型） |
| 容器化 | Docker + Docker Compose |
| 包管理器 | pnpm（workspaces） |

---

## 本地开发准备

### 前置条件

- Node.js 20+
- pnpm 9+（`npm install -g pnpm`）
- PostgreSQL 15+（本地运行）
- Redis 7+（本地运行）

### 安装 PostgreSQL（Windows）

1. 下载并安装 [PostgreSQL](https://www.postgresql.org/download/windows/)
2. 安装时设置密码（默认用户 `postgres`）
3. 创建数据库：
   ```sql
   CREATE DATABASE ai_points_platform;
   CREATE DATABASE ai_points_platform_test;
   ```

### 安装 Redis（Windows）

使用 WSL2 或 [Memurai](https://www.memurai.com/)（Windows Redis 兼容实现）：
```bash
# WSL2 方式
wsl
sudo apt-get install redis-server
sudo service redis-server start
```

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example backend/.env
# 编辑 backend/.env，填写数据库密码、JWT 密钥、LLM API Key 等
```

生成 JWT 密钥：

```bash
openssl rand -hex 64   # 用作 JWT_SECRET
openssl rand -hex 64   # 用作 JWT_REFRESH_SECRET
```

### 3. 运行数据库迁移

```bash
pnpm --filter backend migration:run
```

### 4. 启动开发服务器

```bash
pnpm dev
# 后端: http://localhost:3000
# 前端: http://localhost:5173
```

### 常用命令

```bash
# 后端
pnpm --filter backend type-check   # TypeScript 类型检查
pnpm --filter backend lint         # ESLint 检查
pnpm --filter backend test         # 运行单元测试

# 前端
pnpm --filter frontend type-check  # vue-tsc 类型检查
pnpm --filter frontend lint        # ESLint 检查
pnpm --filter frontend build       # 生产构建

# 数据库 migration
pnpm --filter backend migration:run
```

---

## 生产部署 — Docker Compose

### 1. 准备环境变量

```bash
cp .env.example .env
# 务必设置强密码：DB_PASSWORD、JWT_SECRET、JWT_REFRESH_SECRET、LLM_API_KEY
```

### 2. 构建并启动

```bash
docker compose up -d --build
```

启动的服务：

| 服务 | 端口 |
|---|---|
| 前端 (nginx) | 80 |
| 后端 (NestJS) | 3000（内部） |
| PostgreSQL | 5432（内部） |
| Redis | 6379（内部） |

前端 nginx 会自动将 `/api/*` 请求反向代理到后端容器。

### 3. 停止

```bash
docker compose down
```

持久化数据存储在具名 Docker 卷（`postgres_data`、`redis_data`、`uploads_data`）中，容器重启后数据不丢失。

---

## 环境变量说明

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL 主机 |
| `DB_PORT` | `5432` | PostgreSQL 端口 |
| `DB_NAME` | `ai_points` | 数据库名 |
| `DB_USER` | `postgres` | 数据库用户 |
| `DB_PASSWORD` | `changeme` | 数据库密码 |
| `REDIS_HOST` | `localhost` | Redis 主机 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | `changeme` | Redis 密码 |
| `JWT_SECRET` | — | JWT 签名密钥（必填） |
| `JWT_REFRESH_SECRET` | — | JWT 刷新令牌密钥（必填） |
| `LLM_API_KEY` | — | Anthropic API Key（必填） |
| `LLM_BASE_URL` | _（空）_ | 覆盖 LLM API 地址 |
| `LLM_MODEL` | `claude-sonnet-4-6` | 模型 ID |
| `LLM_TEMPERATURE` | `0.3` | 推理温度 |
| `SMTP_HOST` | — | SMTP 服务器主机名 |
| `SMTP_PORT` | `587` | SMTP 端口 |
| `SMTP_USER` | — | SMTP 用户名 |
| `SMTP_PASS` | — | SMTP 密码 |
| `EMAIL_FROM` | `noreply@example.com` | 系统邮件发件人地址 |
| `UPLOAD_DIR` | `./uploads` | 上传文件目录 |
| `MAX_FILE_SIZE_MB` | `10` | 最大上传文件大小（MB） |
| `VITE_API_BASE_URL` | `/api` | 前端构建时的 API 基础路径 |

---

## 项目结构

```
ai-points-platform/
├── backend/          # NestJS API 服务
│   ├── src/
│   │   ├── auth/
│   │   ├── points/   # 工分与退火逻辑
│   │   ├── project/
│   │   ├── task/
│   │   ├── vote/
│   │   └── ...
│   └── Dockerfile
├── frontend/         # Vue 3 SPA
│   ├── src/
│   │   ├── pages/
│   │   ├── stores/
│   │   ├── services/
│   │   └── components/
│   ├── Dockerfile
│   └── nginx.conf
├── e2e/              # Playwright 端对端测试
│   ├── tests/
│   ├── playwright.config.ts
│   └── package.json
├── docker-compose.yml
├── .env.example
└── package.json      # pnpm workspace 根
```

---

## E2E 测试

```bash
cd e2e
pnpm install
pnpm test          # 无头模式
pnpm test:ui       # 交互式 UI 模式
```

运行前需确保前端开发服务器在 `http://localhost:5173` 启动。

---

## API 文档

后端启动后访问：http://localhost:3000/api（Swagger，Phase 2 后可用）

健康检查：http://localhost:3000/health
