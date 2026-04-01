# Cytopia 赛托邦 — 治理体系升级

## Context

赛托邦平台当前存在严重的治理缺陷：超级管理员没有完整管理后台（导航入口缺失、角色下拉不含 super_admin）；权限系统硬编码为 4 个枚举角色，无法自定义；AI 评分不可复议；工分/决策/审计轨迹不公开。此次升级将平台从硬编码科层制改造为动态权限、民主评审、透明公示的自治协作系统。

**PRD 路径**：`.claude/discovery/governance-upgrade-20260401-0030-PRD.md`

## 关键决策

1. **RBAC 方案**：CASL AbilityFactory + 数据库驱动（roles/role_permissions 表），资源+动作级粒度
2. **角色作用域**：租户级 + 项目级双层，单角色制（每个作用域一个角色）
3. **管理后台**：合并 HR + Super Admin 为统一 /admin，权限控制 Tab 可见性
4. **评审会议**：Socket.IO 实时协作，替代旧 yes/no 投票系统。投分无上限（支持 Bonus）
5. **公示区**：可配置 internal/public，排行榜用结算快照
6. **竞拍引擎**：通用独立模块，事件驱动结果回写，活跃工分竞拍
7. **迁移策略**：单个 TypeORM migration 文件+事务，一次性切换
8. **WebSocket 路由**：复用 /api/ 路径（前端 nginx 加 /socket.io/ location block）
9. **执行模式**：Delegated（Generator + Evaluator 长命 Subagent）

## 模块总览与依赖图

```
阶段 0: 基础设施（包安装、迁移、配置）
    ↓
阶段 1: M1 动态角色权限（后端核心）──→ M6 员工建项目（权限变更）
    ↓
阶段 2: M3 审计日志（后端独立）        M1 前端（权限矩阵 UI）
    ↓                                    ↓
阶段 3: M2 统一管理后台（前后端，依赖 M1 + M3）
    ↓
阶段 4: M5 实时评审会议（后端 Socket.IO + 前端，最复杂）
    ↓
阶段 5: M7 通用竞拍引擎（后端 Bull + 前端）
    ↓
阶段 6: M4 公示区（前后端，依赖 M3/M5 的数据）
    ↓
阶段 7: 集成测试、部署、验证
```

## 关键文件索引

### 后端（需修改/新建）
| 文件 | 操作 | 模块 |
|------|------|------|
| `backend/package.json` | 修改（加 socket.io 等依赖） | 基础 |
| `backend/src/database/migrations/1700000000018-GovernanceUpgrade.ts` | 新建 | M1 |
| `backend/src/rbac/` 目录 | 新建（entities, ability-factory, guard, decorators, module, service, controller） | M1 |
| `backend/src/user/entities/user.entity.ts` | 修改（删 role 字段, 加 userRole 关系） | M1 |
| `backend/src/user/guards/roles.guard.ts` | 废弃（被 PoliciesGuard 替代） | M1 |
| `backend/src/audit/` 目录 | 新建（entity, interceptor, service, module, controller） | M3 |
| `backend/src/app.module.ts` | 修改（注册新模块） | 多模块 |
| `backend/src/main.ts` | 修改（注册 AuditInterceptor） | M3 |
| `backend/src/admin/admin.controller.ts` | 修改（Guard 替换） | M1 |
| `backend/src/meeting/` 目录 | 新建（entity, service, gateway, module, processor） | M5 |
| `backend/src/auction/` 目录 | 新建（entity, service, controller, module, listener, processor） | M7 |
| `backend/src/bulletin/` 目录 | 新建（service, controller, module） | M4 |
| `backend/src/task/enums/task-status.enum.ts` | 修改（加 PENDING_REVIEW） | M5 |
| `backend/src/task/task-state-machine.ts` | 修改（新状态转换） | M5 |
| `backend/src/task/entities/task.entity.ts` | 修改（加 claimMode） | M5 |
| `backend/src/settlement/settlement.service.ts` | 修改（适配评审会议触发） | M5 |
| `backend/src/queue/queue.module.ts` | 修改（注册新队列） | M5/M7 |
| `backend/src/queue/queue.constants.ts` | 修改（新常量） | M5/M7 |
| `frontend/nginx.conf` | 修改（加 /socket.io/ location） | 基础 |

### 前端（需修改/新建）
| 文件 | 操作 | 模块 |
|------|------|------|
| `frontend/package.json` | 修改（加 socket.io-client） | 基础 |
| `frontend/src/services/rbac.ts` | 新建 | M1 |
| `frontend/src/stores/auth.ts` | 修改（存权限列表） | M1 |
| `frontend/src/stores/permission.ts` | 新建 | M1 |
| `frontend/src/composables/useAbility.ts` | 新建 | M1 |
| `frontend/src/pages/admin/AdminPage.vue` | 新建（统一管理后台） | M2 |
| `frontend/src/pages/admin/tabs/*.vue` | 新建（9 个 Tab 组件） | M2/M3 |
| `frontend/src/pages/meeting/ReviewMeetingPage.vue` | 新建 | M5 |
| `frontend/src/composables/useMeeting.ts` | 新建（Socket.IO） | M5 |
| `frontend/src/pages/bulletin/BulletinPage.vue` | 新建 | M4 |
| `frontend/src/pages/bulletin/tabs/*.vue` | 新建（4 个子页面） | M4 |
| `frontend/src/pages/auction/AuctionPage.vue` | 新建 | M7 |
| `frontend/src/layouts/MainLayout.vue` | 修改（侧边栏新入口） | M2/M4 |
| `frontend/src/router/index.ts` | 修改（新路由） | 多模块 |

## 阶段 0：基础设施

- [ ] T1. 安装后端依赖
  - 文件：`backend/package.json`
  - 变更：添加 dependencies — `@casl/ability`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `@nestjs/event-emitter`
  - 验证：`cd backend && pnpm install` 成功
  - 预期：lockfile 更新，无错误
  - 前置：无

- [ ] T2. 安装前端依赖
  - 文件：`frontend/package.json`
  - 变更：添加 dependency — `socket.io-client`
  - 验证：`cd frontend && pnpm install` 成功
  - 预期：lockfile 更新，无错误
  - 前置：无

- [ ] T3. 前端 Nginx 添加 WebSocket 代理
  - 文件：`frontend/nginx.conf`
  - 变更：在 `/api/` location 前新增 `/socket.io/` location block，包含 `proxy_pass http://backend:3000/socket.io/`、`Upgrade`/`Connection` headers、`proxy_read_timeout 3600s`
  - 验证：`nginx -t`（在容器内或本地构建时）
  - 预期：config test passed
  - 前置：无

- [ ] T4. 数据库迁移（单事务）
  - 文件：`backend/src/database/migrations/1700000000018-GovernanceUpgrade.ts`（新建）
  - 变更：在一个事务内执行：
    ```
    1. CREATE TABLE roles (id uuid PK, "tenantId" uuid, name varchar, description varchar, scope varchar CHECK('tenant','project'), "isSystem" bool DEFAULT false, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)
    2. CREATE TABLE role_permissions (id uuid PK, "roleId" uuid FK→roles, resource varchar, action varchar, UNIQUE("roleId", resource, action))
    3. CREATE TABLE user_roles (id uuid PK, "userId" uuid FK→users, "roleId" uuid FK→roles, UNIQUE("userId"))
    4. INSERT 系统角色：super_admin, hr_admin, project_lead, employee (scope='tenant', isSystem=true), lead, member (scope='project', isSystem=true)
    5. INSERT 各角色默认权限到 role_permissions
    6. 读取现有 users.role → 创建 user_roles 映射
    7. ALTER TABLE project_members ADD "projectRoleId" uuid FK→roles DEFAULT (member角色id)
    8. ALTER TABLE users DROP COLUMN role; DROP TYPE role_enum
    9. CREATE TABLE audit_logs (...)
    10. CREATE TABLE review_meetings (...)
    11. CREATE TABLE review_votes (...)
    12. CREATE TABLE task_contributions (...)
    13. CREATE TABLE points_snapshots (...)
    14. CREATE TABLE auctions (...)
    15. CREATE TABLE bids (...)
    16. ALTER TYPE task_status_enum ADD VALUE 'pending_review'
    17. ALTER TABLE tasks ADD COLUMN "claimMode" varchar DEFAULT 'single'
    18. UPDATE tasks SET status='pending_review' WHERE status='pending_vote'
    ```
  - 验证：`cd backend && pnpm build && npx typeorm migration:run -d dist/database/data-source.js`（本地 dev DB）
  - 预期：迁移成功，无错误
  - 前置：T1

## 阶段 1：M1 动态角色权限系统（后端）

- [ ] T5. 创建 Role + RolePermission 实体
  - 文件：`backend/src/rbac/entities/role.entity.ts`（新建）, `backend/src/rbac/entities/role-permission.entity.ts`（新建）
  - 变更：
    - `Role` entity: id, tenantId, name, description, scope('tenant'|'project'), isSystem(bool), createdAt, updatedAt. 关联 `@OneToMany(() => RolePermission)`
    - `RolePermission` entity: id, roleId, resource(string), action(string). `@ManyToOne(() => Role)` + `@Unique(['roleId', 'resource', 'action'])`
  - 验证：`pnpm build` 无类型错误
  - 预期：编译通过
  - 前置：T4

- [ ] T6. 创建 UserRole 实体 + 修改 User 实体
  - 文件：`backend/src/rbac/entities/user-role.entity.ts`（新建）, `backend/src/user/entities/user.entity.ts`（修改）
  - 变更：
    - `UserRole` entity: id, userId, roleId. `@ManyToOne(() => User)`, `@ManyToOne(() => Role)`, `@Unique(['userId'])`
    - `User` entity: 删除 `@Column({ type: 'enum', enum: Role })` 字段，新增 `@OneToOne(() => UserRole) userRole` 关联
  - 验证：`pnpm build`
  - 前置：T5

- [ ] T7. 修改 ProjectMember 实体
  - 文件：`backend/src/project/entities/project-member.entity.ts`
  - 变更：新增 `@Column('uuid') projectRoleId` + `@ManyToOne(() => Role) projectRole` 关联
  - 验证：`pnpm build`
  - 前置：T5

- [ ] T8. 创建 CaslAbilityFactory
  - 文件：`backend/src/rbac/casl-ability.factory.ts`（新建）
  - 变更：
    ```
    @Injectable() CaslAbilityFactory:
      constructor(@InjectRepository(UserRole), @InjectRepository(RolePermission), @InjectRepository(ProjectMember))

      async createForUser(userId: string, tenantId: string): AppAbility
        1. 查 user_roles → 拿到 roleId
        2. 查 role_permissions WHERE roleId → 得到 [{resource, action}]
        3. 用 @casl/ability 的 AbilityBuilder 构建: can(action, resource)
        4. 返回 build() 的 Ability 对象

      async createForProject(userId: string, projectId: string, tenantId: string): AppAbility
        1. 查 project_members WHERE userId AND projectId → 拿到 projectRoleId
        2. 查 role_permissions WHERE roleId = projectRoleId
        3. 构建 Ability
    ```
  - 验证：`pnpm build`
  - 前置：T5, T6

- [ ] T9. 创建 PoliciesGuard + CheckPolicies 装饰器
  - 文件：`backend/src/rbac/policies.guard.ts`（新建）, `backend/src/rbac/decorators/check-policies.decorator.ts`（新建）
  - 变更：
    - `CheckPolicies(resource: string, action: string)` decorator — 设置 metadata
    - `PoliciesGuard implements CanActivate`:
      1. 读 `@CheckPolicies()` metadata（resource, action）
      2. 如无 metadata → return true（向后兼容无装饰器的路由）
      3. 从 request.user 取 userId, tenantId
      4. 调用 CaslAbilityFactory.createForUser()
      5. 检查 ability.can(action, resource)
      6. 不满足 → throw ForbiddenException('权限不足')
  - 验证：`pnpm build`
  - 前置：T8

- [ ] T10. 创建 RbacService + RbacController
  - 文件：`backend/src/rbac/rbac.service.ts`（新建）, `backend/src/rbac/rbac.controller.ts`（新建）
  - 变更：
    - Service: CRUD for roles + permissions. 方法: `listRoles(tenantId, scope?)`, `createRole(tenantId, dto)`, `updateRole(roleId, tenantId, dto)`, `deleteRole(roleId, tenantId)` (禁止删除 isSystem), `getPermissions(roleId)`, `setPermissions(roleId, permissions[])`, `assignTenantRole(userId, roleId, tenantId)`, `assignProjectRole(userId, projectId, roleId, tenantId)`, `getUserPermissions(userId, tenantId)` (返回扁平权限列表给前端)
    - Controller: `@Controller('rbac')`, 所有端点需 JWT + CheckPolicies('roles', 'read/create/update/delete')
    - DTO: CreateRoleDto(name, description, scope), UpdateRoleDto, SetPermissionsDto(permissions: {resource,action}[])
  - 验证：`pnpm build`
  - 前置：T8, T9

- [ ] T11. 创建 RbacModule + 注册到 AppModule
  - 文件：`backend/src/rbac/rbac.module.ts`（新建）, `backend/src/app.module.ts`（修改）
  - 变更：
    - RbacModule: imports TypeOrmModule.forFeature([Role, RolePermission, UserRole]), exports CaslAbilityFactory
    - AppModule: 在 imports 中添加 RbacModule
  - 验证：`pnpm build`
  - 前置：T10

- [ ] T12. 全局替换 RolesGuard → PoliciesGuard
  - 文件：所有使用 `@UseGuards(JwtAuthGuard, RolesGuard)` 和 `@Roles(...)` 的 controller
  - 变更：
    - `@UseGuards(JwtAuthGuard, RolesGuard)` → `@UseGuards(JwtAuthGuard, PoliciesGuard)`
    - `@Roles(Role.HR_ADMIN, Role.SUPER_ADMIN)` → `@CheckPolicies('users', 'read')` 等（按各端点的实际资源/动作映射）
    - 涉及文件：admin.controller.ts, super-admin.controller.ts, project.controller.ts, vote.controller.ts, settlement.controller.ts, points.controller.ts, invite.controller.ts
  - 验证：`pnpm build`；用旧 super_admin 账号调用各 API 确认权限正常
  - 前置：T11

- [ ] T13. 修改 JwtStrategy 移除 role 负载
  - 文件：`backend/src/auth/strategies/jwt.strategy.ts`
  - 变更：
    - JwtPayload interface: 删除 `role: string` 字段（保留 sub, email, tenantId）
    - validate() 方法相应调整
    - AuthService 签发 token 时不再包含 role
  - 验证：`pnpm build`；登录获取新 token 后调用 API 正常
  - 前置：T12

## 阶段 1b：M1 动态角色权限系统（前端）

- [ ] T14. 创建 RBAC 前端服务
  - 文件：`frontend/src/services/rbac.ts`（新建）
  - 变更：
    ```ts
    export interface Permission { resource: string; action: string }
    export interface RoleDto { id: string; name: string; description: string; scope: string; isSystem: boolean; userCount?: number }
    export const rbacApi = {
      listRoles: (scope?: string) => api.get<RoleDto[]>('/rbac/roles', { params: { scope } }).then(r => r.data),
      createRole: (dto) => api.post<RoleDto>('/rbac/roles', dto).then(r => r.data),
      updateRole: (id, dto) => api.patch<RoleDto>(`/rbac/roles/${id}`, dto).then(r => r.data),
      deleteRole: (id) => api.delete(`/rbac/roles/${id}`),
      getPermissions: (roleId) => api.get<Permission[]>(`/rbac/roles/${roleId}/permissions`).then(r => r.data),
      setPermissions: (roleId, perms) => api.put(`/rbac/roles/${roleId}/permissions`, { permissions: perms }),
      assignTenantRole: (userId, roleId) => api.patch(`/rbac/users/${userId}/tenant-role`, { roleId }).then(r => r.data),
      assignProjectRole: (userId, projectId, roleId) => api.patch(`/rbac/users/${userId}/project-role`, { projectId, roleId }).then(r => r.data),
      getMyPermissions: () => api.get<Permission[]>('/rbac/my-permissions').then(r => r.data),
    }
    ```
  - 验证：`pnpm build`
  - 前置：T10（后端 API 已存在）

- [ ] T15. 创建权限 Store + useAbility composable
  - 文件：`frontend/src/stores/permission.ts`（新建）, `frontend/src/composables/useAbility.ts`（新建）
  - 变更：
    - `permission.ts`: Pinia store, 存 `permissions: Permission[]`, action `fetchPermissions()` 调用 `rbacApi.getMyPermissions()`，`can(action, resource): boolean` 检查方法
    - `useAbility.ts`: composable 封装，`const { can } = useAbility()` 直接使用
    - 修改 `stores/auth.ts` 的 `fetchUser()`：成功后自动调用 `permissionStore.fetchPermissions()`
  - 验证：`pnpm build`；登录后 console 打印权限列表
  - 前置：T14

## 阶段 2：M3 审计日志系统

- [ ] T16. 创建 AuditLog 实体
  - 文件：`backend/src/audit/entities/audit-log.entity.ts`（新建）
  - 变更：Entity 按 migration schema: id, tenantId, actorId, actorName, action(string), resource(string), resourceId(string nullable), previousData(JSONB nullable), newData(JSONB nullable), ipAddress(string nullable), createdAt
  - 验证：`pnpm build`
  - 前置：T4

- [ ] T17. 创建 AuditService
  - 文件：`backend/src/audit/audit.service.ts`（新建）
  - 变更：
    - `record(tenantId, actorId, actorName, action, resource, resourceId?, previousData?, newData?, ipAddress?)` — 插入 audit_logs
    - `list(tenantId, filters: {actorId?, resource?, action?, dateFrom?, dateTo?}, page, limit)` — 分页查询，按 createdAt DESC
    - `getByResource(tenantId, resource, resourceId)` — 获取某资源的变更历史
  - 验证：`pnpm build`
  - 前置：T16

- [ ] T18. 创建 AuditInterceptor
  - 文件：`backend/src/audit/audit.interceptor.ts`（新建）
  - 变更：
    ```
    @Injectable() AuditInterceptor implements NestInterceptor:
      intercept(context, next):
        const request = context.switchToHttp().getRequest()
        if (request.method === 'GET') return next.handle()

        // 从路由推断 resource（如 /admin/users/:id → resource='users'）
        // 对 PATCH/DELETE：先查旧数据（通过 service 查询）

        return next.handle().pipe(
          tap(responseData => {
            auditService.record(...)  // 异步，不阻塞响应
          })
        )
    ```
    - 在 `main.ts` 注册：`app.useGlobalInterceptors(app.get(AuditInterceptor))`
  - 验证：`pnpm build`；调用一个 PATCH API 后检查 audit_logs 表
  - 前置：T17

- [ ] T19. 创建 AuditController + AuditModule
  - 文件：`backend/src/audit/audit.controller.ts`（新建）, `backend/src/audit/audit.module.ts`（新建）
  - 变更：
    - Controller: `GET /audit/logs` (分页+筛选), `GET /audit/logs/:resource/:resourceId` (单资源历史)
    - 需要 `@CheckPolicies('audit', 'read')` 权限
    - Module: imports TypeOrmModule.forFeature([AuditLog]), exports AuditService
    - 注册到 AppModule
  - 验证：`pnpm build`；`curl /api/audit/logs` 返回空数组
  - 前置：T18, T11

## 阶段 3：M2 统一管理后台

- [ ] T20. 后端：扩展 AdminController 新端点
  - 文件：`backend/src/admin/admin.controller.ts`（修改）, `backend/src/admin/admin.service.ts`（修改）
  - 变更：
    - 新增 `GET /admin/users/:id/projects` — 返回用户所属项目列表及项目角色
    - 修改 `PATCH /admin/users/:id/role` → `PATCH /admin/users/:id/tenant-role` 使用新 RBAC
    - 新增 `PATCH /admin/users/:id/project-role` — 修改用户在指定项目中的角色
    - Guard 全部换为 PoliciesGuard + CheckPolicies
  - 验证：`pnpm build`
  - 前置：T12

- [ ] T21. 前端：创建统一 AdminPage
  - 文件：`frontend/src/pages/admin/AdminPage.vue`（新建）
  - 变更：
    - Tab 栏组件，根据 `permissionStore.can()` 动态过滤可见 Tab
    - Tab 配置数组：`[{key, label, permission: {resource, action}, component}]`
    - 每个 Tab 懒加载对应组件
    - 从 HrAdminPage 和 SuperAdminPage 迁移各 Tab 功能到独立组件
  - 验证：`pnpm build`；登录 super_admin 看到所有 Tab
  - 前置：T15

- [ ] T22. 前端：用户管理 Tab（展开行+角色分配）
  - 文件：`frontend/src/pages/admin/tabs/UserManagementTab.vue`（新建）
  - 变更：
    - 用户列表表格：姓名/邮箱/租户角色(下拉)/项目数/邮箱验证/注册时间
    - 租户角色下拉从 `rbacApi.listRoles('tenant')` 加载，包含所有角色含 super_admin
    - 点击行展开：显示用户项目列表+项目角色下拉（从 `rbacApi.listRoles('project')` 加载）
    - 按 HrAdminPage 的交互模式（loading/error/optimistic update）
  - 验证：`pnpm build`；能修改用户租户角色和项目角色
  - 前置：T21, T14

- [ ] T23. 前端：角色与权限 Tab（权限矩阵）
  - 文件：`frontend/src/pages/admin/tabs/RolePermissionTab.vue`（新建）
  - 变更：
    - 左侧角色列表 + 右侧权限矩阵
    - 矩阵纵轴：资源列表（users/projects/tasks/points/votes/settlements/dividends/tenants/config/audit/bulletin/auctions）
    - 矩阵横轴：动作（read/create/update/delete + 特殊动作列）
    - 勾选框交叉点，保存时调用 `rbacApi.setPermissions()`
    - "新建角色"按钮打开模态框
    - 系统角色标记不可删除（删除按钮 disabled）
  - 验证：`pnpm build`；创建自定义角色并配置权限后，分配给用户验证权限生效
  - 前置：T21, T14

- [ ] T24. 前端：迁移其他 Tab 组件
  - 文件：`frontend/src/pages/admin/tabs/InviteTab.vue`、`ApprovalTab.vue`、`TenantTab.vue`、`ConfigTab.vue`、`StatsTab.vue`（新建）
  - 变更：从 HrAdminPage 和 SuperAdminPage 提取各 Tab 内容到独立组件，保持原有功能不变，只换 Guard 为权限判断
  - 验证：`pnpm build`；各 Tab 功能与原页面一致
  - 前置：T21

- [ ] T25. 前端：更新路由和侧边栏导航
  - 文件：`frontend/src/router/index.ts`（修改）, `frontend/src/layouts/MainLayout.vue`（修改）
  - 变更：
    - 路由：新增 `/admin` → AdminPage.vue；`/admin/hr` 和 `/admin/super` redirect → `/admin`；新增 `/bulletin`、`/meeting/:id`、`/auctions` 路由
    - 侧边栏：`isAdminRole` 判断改为 `permissionStore.can('read', 'admin')`；新增"公示区"入口（所有人可见）；新增"竞拍"入口
  - 验证：`pnpm build`；各导航入口正确
  - 前置：T21, T15

## 阶段 4：M5 实时评审会议

- [ ] T26. 创建 ReviewMeeting + ReviewVote + TaskContribution 实体
  - 文件：`backend/src/meeting/entities/review-meeting.entity.ts`、`review-vote.entity.ts`、`task-contribution.entity.ts`（新建）
  - 变更：按 migration schema 创建三个实体
  - 验证：`pnpm build`
  - 前置：T4

- [ ] T27. 修改任务状态机
  - 文件：`backend/src/task/enums/task-status.enum.ts`（修改）, `backend/src/task/task-state-machine.ts`（修改）, `backend/src/task/entities/task.entity.ts`（修改）
  - 变更：
    - 枚举新增 `PENDING_REVIEW = 'pending_review'`
    - 状态转换：`AI_REVIEWING → [PENDING_REVIEW, CANCELLED]`、`PENDING_REVIEW → [SETTLED, CANCELLED]`
    - 删除旧 `PENDING_VOTE` 的出转换（保留枚举值向后兼容旧数据）
    - Task entity: 新增 `@Column({ type: 'varchar', default: 'single' }) claimMode: 'single' | 'multi'`
  - 验证：`pnpm build`
  - 前置：T26

- [ ] T28. 修改 AI Review Processor 输出状态
  - 文件：`backend/src/queue/processors/ai-review.processor.ts`
  - 变更：AI 评审完成后，task 状态从 `AI_REVIEWING → PENDING_REVIEW`（原来是 PENDING_VOTE）
  - 验证：`pnpm build`
  - 前置：T27

- [ ] T29. 创建 MeetingService
  - 文件：`backend/src/meeting/meeting.service.ts`（新建）
  - 变更：
    - `createMeeting(tenantId, projectId, createdBy)`: 查所有 PENDING_REVIEW 任务，创建会议记录，返回 meeting + taskIds
    - `castVote(meetingId, taskId, userId, tenantId, {isApproval, score?})`: 写 review_votes，UNIQUE 约束防重复
    - `setContributions(meetingId, taskId, tenantId, contributions: {userId, percentage}[])`: 写 task_contributions
    - `confirmTask(meetingId, taskId, tenantId)`: 计算中位数最终分，写入 meeting.results JSONB
    - `closeMeeting(meetingId, tenantId, closedBy)`: 设置 status=closed，触发结算。对每个已确认任务调用 SettlementService
    - `getMeeting(meetingId, tenantId)`: 返回会议详情含 votes 和 contributions
  - 验证：`pnpm build`
  - 前置：T26, T27

- [ ] T30. 修改 SettlementService 适配评审会议
  - 文件：`backend/src/settlement/settlement.service.ts`（修改）
  - 变更：
    - 新增 `settleFromMeeting(meetingId, tenantId, triggeredBy)`:
      1. 读取 meeting.results 中每个任务的 finalScore
      2. 计算 finalPoints = max(1, round(estimatedPoints × finalScore / 15))
      3. 处理多人任务：为每个 contributor 按 percentage 分配工分
      4. 创建 Settlement 记录
      5. 生成 points_snapshots 快照
      6. 创建 dividend draft
    - 原有 `triggerSettlement(voteSessionId)` 保留，但标注 @deprecated
  - 验证：`pnpm build`
  - 前置：T29

- [ ] T31. 创建 MeetingGateway（Socket.IO）
  - 文件：`backend/src/meeting/meeting.gateway.ts`（新建）
  - 变更：
    ```
    @WebSocketGateway({ namespace: '/meeting', cors: { origin: '*' } })
    export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect:
      @WebSocketServer() server: Server

      handleConnection(client): 验证 JWT token（从 handshake.auth.token），加入 meeting room
      handleDisconnect(client): 离开 room，广播在线人数更新

      @SubscribeMessage('join')
      handleJoin(client, {meetingId}): 加入 room `meeting:${meetingId}`，广播 participant count

      @SubscribeMessage('focus')
      handleFocus(client, {meetingId, taskId}): 验证是 lead → 广播 'meeting:focus' 给 room

      @SubscribeMessage('vote')
      handleVote(client, {meetingId, taskId, isApproval, score?}): 调用 service.castVote → 广播 'meeting:stats'

      @SubscribeMessage('contribution')
      handleContribution(client, {meetingId, taskId, contributions}): 调用 service.setContributions → 广播

      @SubscribeMessage('confirm')
      handleConfirm(client, {meetingId, taskId}): 调用 service.confirmTask → 广播 'meeting:confirmed'

      @SubscribeMessage('end')
      handleEnd(client, {meetingId}): 调用 service.closeMeeting → 广播 'meeting:ended'
    ```
  - 验证：`pnpm build`；用 Socket.IO 测试客户端连接
  - 前置：T29

- [ ] T32. 创建 MeetingController + MeetingModule
  - 文件：`backend/src/meeting/meeting.controller.ts`、`backend/src/meeting/meeting.module.ts`（新建）
  - 变更：
    - Controller: `POST /meetings`(创建), `GET /meetings/:id`(详情), `GET /meetings`(列表), `PATCH /meetings/:id/close`(关闭-HTTP备用)
    - Module: imports TypeOrmModule, exports MeetingService, providers includes MeetingGateway
    - 注册到 AppModule
  - 验证：`pnpm build`；`POST /api/meetings` 创建会议成功
  - 前置：T31

- [ ] T33. 前端：创建 useMeeting composable
  - 文件：`frontend/src/composables/useMeeting.ts`（新建）
  - 变更：
    - Socket.IO 连接管理：connect(meetingId, token) / disconnect()
    - 响应式状态：focusedTaskId, votes(Map), participants, isConnected
    - 事件监听：on('meeting:focus'), on('meeting:stats'), on('meeting:confirmed'), on('meeting:ended')
    - 发送方法：emitVote(), emitFocus(), emitContribution(), emitConfirm(), emitEnd()
  - 验证：`pnpm build`
  - 前置：T2（socket.io-client 已安装）

- [ ] T34. 前端：创建评审会议页面
  - 文件：`frontend/src/pages/meeting/ReviewMeetingPage.vue`（新建）
  - 变更：
    - 顶部：会议标题/进度/在线人数
    - 主体：多维表格（任务名/提交人/AI分/最终分/状态），当前行橙色高亮
    - 聚焦行展开区：AI 评分详情 + 投票区（认可按钮 + 分数输入框）+ 实时统计
    - 多人任务贡献分配表格（百分比输入框）
    - 底部：上一项 / 确认并下一项 / 结束会议
    - 会议结束确认弹窗（汇总 N 条认可/复议/总工分）
  - 验证：`pnpm build`；创建会议后打开页面，Socket.IO 连接成功
  - 前置：T33, T25

- [ ] T35. 前端：项目详情页添加"开启评审会议"按钮
  - 文件：`frontend/src/pages/project/ProjectDetailPage.vue`（修改）
  - 变更：在任务 Tab 区域新增"开启评审会议"按钮（需 votes:create 权限），点击调用 `POST /meetings` 后跳转到会议页面
  - 验证：`pnpm build`
  - 前置：T34

## 阶段 5：M7 通用竞拍引擎

- [ ] T36. 创建 Auction + Bid 实体
  - 文件：`backend/src/auction/entities/auction.entity.ts`、`bid.entity.ts`（新建）
  - 变更：按 migration schema 创建实体
  - 验证：`pnpm build`
  - 前置：T4

- [ ] T37. 创建 AuctionService
  - 文件：`backend/src/auction/auction.service.ts`（新建）
  - 变更：
    - `create(tenantId, dto: {type, targetEntity, targetId, description, minBid, durationHours, createdBy})`: 创建 auction + 添加 Bull 延迟任务
    - `placeBid(auctionId, userId, tenantId, amount)`: 校验 > 当前最高价，写入 bid
    - `close(auctionId)`: 找最高 bid 作为 winner，设 status=closed，发射 EventEmitter 事件 `auction.closed`
    - `cancel(auctionId, tenantId)`: 取消竞拍
    - `list(tenantId, filters)`, `get(auctionId, tenantId)`: 查询
  - 验证：`pnpm build`
  - 前置：T36

- [ ] T38. 创建竞拍自动关闭 Processor
  - 文件：`backend/src/queue/processors/auction-close.processor.ts`（新建）, `backend/src/queue/queue.constants.ts`（修改）, `backend/src/queue/queue.module.ts`（修改）
  - 变更：
    - queue.constants: 新增 `AUCTION_CLOSE: 'auction-close'`
    - queue.module: 注册新队列
    - Processor: `@Process('auto-close')` → 调用 `auctionService.close(auctionId)`
  - 验证：`pnpm build`
  - 前置：T37

- [ ] T39. 创建 TaskAuctionListener
  - 文件：`backend/src/auction/listeners/task-auction.listener.ts`（新建）
  - 变更：
    - `@OnEvent('auction.closed')` handler:
      - 如果 auction.type === 'task_claim': 将 task.assigneeId 设为 winner
      - 创建负工分记录（bid amount 扣减）
  - 验证：`pnpm build`
  - 前置：T37

- [ ] T40. 创建 AuctionController + AuctionModule
  - 文件：`backend/src/auction/auction.controller.ts`、`auction.module.ts`（新建）
  - 变更：Controller CRUD + bid endpoint. Module 注册 EventEmitter. 注册到 AppModule.
  - 验证：`pnpm build`；API 可用
  - 前置：T38, T39

- [ ] T41. 修改任务认领逻辑（自动触发竞拍）
  - 文件：`backend/src/task/task.service.ts`（修改）
  - 变更：`claimTask()` 中，如果 task.claimMode='single' 且已有 assignee → 自动创建 auction（type=task_claim），第一人出价 0
  - 验证：第二人认领已有人认领的 single 任务时，自动创建竞拍
  - 前置：T40

- [ ] T42. 前端：竞拍页面
  - 文件：`frontend/src/pages/auction/AuctionListPage.vue`（新建）, `frontend/src/services/auction.ts`（新建）
  - 变更：竞拍列表（标的物/最高出价/截止时间/状态）+ 详情页（出价历史+出价输入）。服务层 CRUD。
  - 验证：`pnpm build`
  - 前置：T40, T25

## 阶段 6：M4 公示区

- [ ] T43. 创建 BulletinService
  - 文件：`backend/src/bulletin/bulletin.service.ts`（新建）
  - 变更：
    - `getLeaderboard(tenantId, projectId?)`: 读 points_snapshots 最新快照
    - `getSettlements(tenantId, page, limit)`: 读 settlements 表分页
    - `getDividends(tenantId, page, limit)`: 读 dividends 表分页
    - `getDecisions(tenantId, page, limit)`: 读 review_meetings + review_votes 联查
    - `getAuditTrail(tenantId, page, limit)`: 读 audit_logs 简化版（只返回自然语言描述）
    - `getBulletinConfig(tenantId)`: 读 tenant.settings.bulletinVisibility
    - `sanitizeName(name)`: 脱敏 "张三" → "张**"
  - 验证：`pnpm build`
  - 前置：T17, T29

- [ ] T44. 创建 BulletinController + BulletinModule
  - 文件：`backend/src/bulletin/bulletin.controller.ts`、`bulletin.module.ts`（新建）
  - 变更：
    - 内部路由 `GET /bulletin/*`：需 JWT
    - 公开路由 `GET /public/:tenantSlug/bulletin/*`：不需 JWT，返回脱敏数据
    - Module 注册到 AppModule
  - 验证：`pnpm build`；内部路由需 token，公开路由无需 token
  - 前置：T43

- [ ] T45. 修改结算流程生成快照
  - 文件：`backend/src/settlement/settlement.service.ts`（修改）
  - 变更：在 `settleFromMeeting()` 结束后，计算所有项目成员的活跃工分排名，写入 `points_snapshots` 表
  - 验证：结算后 points_snapshots 表有新记录
  - 前置：T30

- [ ] T46. 前端：公示区页面
  - 文件：`frontend/src/pages/bulletin/BulletinPage.vue`（新建）, `frontend/src/pages/bulletin/tabs/LeaderboardTab.vue`、`LedgerTab.vue`、`DecisionTab.vue`、`AuditTrailTab.vue`（新建）, `frontend/src/services/bulletin.ts`（新建）
  - 变更：
    - BulletinPage: Tab 布局（排行榜/账目/决策/审计）
    - LeaderboardTab: 按项目/按组织切换，表格展示排名
    - LedgerTab: 结算记录列表 + 分红记录列表
    - DecisionTab: 评审会议记录，展开看投票详情
    - AuditTrailTab: 自然语言管理操作日志
    - Service: bulletinApi 对接后端
  - 验证：`pnpm build`；公示区各 Tab 正常渲染
  - 前置：T44, T25

- [ ] T47. 管理后台：公示区设置 Tab
  - 文件：`frontend/src/pages/admin/tabs/BulletinSettingsTab.vue`（新建）
  - 变更：开关控件切换 internal/public，调用 tenant settings API 保存
  - 验证：`pnpm build`；切换后公开链接可/不可访问
  - 前置：T24

- [ ] T48. 管理后台：审计日志 Tab
  - 文件：`frontend/src/pages/admin/tabs/AuditLogTab.vue`（新建）
  - 变更：表格 + 筛选器（操作人/日期/类型）+ 展开行 JSON diff
  - 验证：`pnpm build`
  - 前置：T19（后端 API）, T24

## 阶段 7：集成与部署

- [ ] T49. 更新 deploy.yml 宿主机 Nginx 配置
  - 文件：`.github/workflows/deploy.yml`
  - 变更：宿主机 Nginx 配置 base64 blob 更新，添加 WebSocket `Upgrade` headers 到 `location /` block
  - 验证：部署后 WebSocket 连接成功
  - 前置：所有前置任务

- [ ] T50. 更新 CLAUDE.md
  - 文件：`CLAUDE.md`
  - 变更：更新模块说明（新增 rbac/audit/meeting/auction/bulletin 模块）、Nginx 配置、数据库表、任务状态机
  - 前置：T49

- [ ] T51. 全量构建验证
  - 验证：`cd backend && pnpm build`、`cd frontend && pnpm build`，全部通过
  - 前置：T1-T50

- [ ] T52. 生产部署 + 端到端验证
  - 验证：
    1. 推送代码触发 CI/CD
    2. 迁移成功执行
    3. super_admin 登录 → 看到统一管理后台所有 Tab
    4. 创建自定义角色 → 分配给用户 → 用户权限生效
    5. 提交任务 → AI 评审 → 开启评审会议 → Socket.IO 实时同步 → 投票 → 结算
    6. 公示区数据正确展示
    7. 竞拍流程：创建 → 出价 → 自动开奖
  - 前置：T51

## 质量保障

- **TypeScript 严格模式**：所有新代码通过 `tsc --noEmit`（后端）和 `vue-tsc --noEmit`（前端）
- **迁移原子性**：单事务迁移，失败自动回滚
- **Guard 向后兼容**：PoliciesGuard 无 metadata 时 return true，不破坏未装饰的路由
- **错误消息中文**：所有用户可见错误用中文

## 风险与应对

| 风险 | 应对 |
|------|------|
| 迁移数据量大导致事务超时 | 当前用户量小（<100），不会超时 |
| Socket.IO 在 Docker 中连接失败 | Nginx 配置 WebSocket upgrade + 3600s timeout |
| CASL 每次请求查 DB 性能 | 用户量小无需缓存；未来可加 Redis 缓存角色权限 |
| 旧 JWT token 含 role 字段 | PoliciesGuard 不依赖 token 中的 role，只用 userId 从 DB 加载 |

## 验证方案

1. **后端构建**：`cd backend && pnpm build` 无错误
2. **前端构建**：`cd frontend && pnpm build` 无错误
3. **迁移验证**：本地 dev DB 跑迁移成功，数据完整
4. **权限验证**：不同角色用户调用 API，验证权限正确拒绝/允许
5. **Socket.IO 验证**：两个浏览器窗口同时加入会议，聚焦行同步
6. **公示区验证**：internal 模式需登录，public 模式脱敏正确
7. **竞拍验证**：创建竞拍 → 出价 → 24h 后自动开奖（可用 Bull 面板手动触发）
8. **生产部署**：CI/CD 全流程 + Playwright 自动化验收
