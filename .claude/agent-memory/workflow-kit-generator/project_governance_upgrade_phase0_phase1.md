---
name: 治理体系升级 Phase0+Phase1+Phase2 实施记录
description: T1-T25 完成状态，关键架构决策，模块依赖关系
type: project
---

## 完成状态（2026-03-31）

T1-T13 全部完成（后端 RBAC）。Build 0 错误，type-check 通过。
T14-T25 全部完成（前端 RBAC+审计+管理统一页面）。后端+前端 build 均零错误通过。

### T14-T25 新建文件清单
- `frontend/src/services/rbac.ts` — RBAC API 服务
- `frontend/src/stores/permission.ts` — 权限 Store（setup store）
- `frontend/src/composables/useAbility.ts` — useAbility composable
- `frontend/src/pages/admin/AdminPage.vue` — 统一管理入口（动态 tab + 权限过滤）
- `frontend/src/pages/admin/tabs/UserManagementTab.vue` — 用户管理+展开项目角色
- `frontend/src/pages/admin/tabs/RolePermissionTab.vue` — 权限矩阵（资源×动作）
- `frontend/src/pages/admin/tabs/InviteTab.vue` — 邀请码管理（从 HrAdminPage 提取）
- `frontend/src/pages/admin/tabs/ApprovalTab.vue` — 工分审批（从 HrAdminPage 提取）
- `frontend/src/pages/admin/tabs/TenantTab.vue` — 租户管理（从 SuperAdminPage 提取）
- `frontend/src/pages/admin/tabs/ConfigTab.vue` — 全局配置（从 SuperAdminPage 提取）
- `frontend/src/pages/admin/tabs/StatsTab.vue` — 运营数据（双数据源：ops+tenant）
- `frontend/src/pages/bulletin/BulletinPage.vue` — 公示区占位
- `frontend/src/pages/meeting/MeetingPage.vue` — 会议详情占位
- `frontend/src/pages/auctions/AuctionsPage.vue` — 竞拍占位
- `backend/src/audit/entities/audit-log.entity.ts` — AuditLog 实体
- `backend/src/audit/audit.service.ts` — 分页 list + record + getByResource
- `backend/src/audit/audit.interceptor.ts` — 全局拦截 non-GET 请求写审计日志（异步）
- `backend/src/audit/audit.controller.ts` — GET /audit/logs, GET /audit/logs/:r/:id
- `backend/src/audit/audit.module.ts` — @Global() 导出 AuditService+AuditInterceptor

## 关键架构决策

**RbacModule 循环依赖处理**：
- UserModule 使用 `forwardRef(() => RbacModule)` 导入 RbacModule
- 原因：UserModule → RbacModule → ProjectMember（TypeORM forFeature，不依赖 ProjectModule），不形成真正循环
- ProjectModule 直接 import RbacModule，无需 forwardRef

**PoliciesGuard 分发方式**：
- PoliciesGuard 在 RbacModule 中声明 providers 并 export
- 所有需要它的模块（admin/super-admin/vote/settlement/points/dividend/invite/project）均 import RbacModule
- 不使用全局 Guard，保持逐 controller 装饰的原有规范

**系统角色 UUID**：
- super_admin: 00000000-0000-0000-0000-000000000001
- hr_admin:     00000000-0000-0000-0000-000000000002
- project_lead: 00000000-0000-0000-0000-000000000003
- employee:     00000000-0000-0000-0000-000000000004
- lead(project):00000000-0000-0000-0000-000000000005
- member(project):00000000-0000-0000-0000-000000000006

**ALTER TYPE ADD VALUE 事务限制**：
- PostgreSQL 不允许在事务内 ALTER TYPE ADD VALUE
- 迁移中先 commitTransaction，然后在事务外执行 ADD VALUE 'pending_review'

**JwtPayload.role 已移除**：
- JWT token 不再包含 role 字段
- 旧 token 仍然有效（validate 方法只检查 sub 和 tenantId）
- 权限通过 DB 实时查询，不依赖 token 中的 role

## 遗留影响

- admin.service.updateUserRole 参数从 Role 枚举改为 roleId UUID
- admin.controller.updateUserRole 请求 body 从 `{ role: 'hr_admin' }` 改为 `{ roleId: 'uuid' }`
- 前端需要适配这个 API 变更

**Why:** 替换硬编码角色枚举为数据库驱动 RBAC
**How to apply:** 后续实现 M2 管理后台时，角色分配 UI 要发 roleId 而不是 role string
