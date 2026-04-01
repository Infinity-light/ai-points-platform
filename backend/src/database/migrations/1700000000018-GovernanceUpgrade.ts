import { MigrationInterface, QueryRunner } from 'typeorm';

export class GovernanceUpgrade1700000000018 implements MigrationInterface {
  name = 'GovernanceUpgrade1700000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // 1. 创建 roles 表
      await queryRunner.query(`
        CREATE TABLE "roles" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenantId" uuid,
          "name" character varying(100) NOT NULL,
          "description" character varying(500),
          "scope" character varying(20) NOT NULL CHECK ("scope" IN ('tenant', 'project')),
          "isSystem" boolean NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_roles" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_roles_tenantId" ON "roles" ("tenantId")`);
      await queryRunner.query(`CREATE INDEX "IDX_roles_scope" ON "roles" ("scope")`);

      // 2. 创建 role_permissions 表
      await queryRunner.query(`
        CREATE TABLE "role_permissions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "roleId" uuid NOT NULL,
          "resource" character varying(100) NOT NULL,
          "action" character varying(100) NOT NULL,
          CONSTRAINT "PK_role_permissions" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_role_permissions_roleId_resource_action" UNIQUE ("roleId", "resource", "action"),
          CONSTRAINT "FK_role_permissions_roleId" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_role_permissions_roleId" ON "role_permissions" ("roleId")`);

      // 3. 创建 user_roles 表
      await queryRunner.query(`
        CREATE TABLE "user_roles" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "userId" uuid NOT NULL,
          "roleId" uuid NOT NULL,
          CONSTRAINT "PK_user_roles" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_user_roles_userId" UNIQUE ("userId"),
          CONSTRAINT "FK_user_roles_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_user_roles_roleId" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_user_roles_roleId" ON "user_roles" ("roleId")`);

      // 4. 插入系统角色（租户级）
      await queryRunner.query(`
        INSERT INTO "roles" ("id", "tenantId", "name", "description", "scope", "isSystem") VALUES
          ('00000000-0000-0000-0000-000000000001', NULL, 'super_admin', '超级管理员，拥有所有权限', 'tenant', true),
          ('00000000-0000-0000-0000-000000000002', NULL, 'hr_admin', 'HR 管理员，管理用户与邀请码', 'tenant', true),
          ('00000000-0000-0000-0000-000000000003', NULL, 'project_lead', '项目负责人，管理项目内容', 'tenant', true),
          ('00000000-0000-0000-0000-000000000004', NULL, 'employee', '普通员工', 'tenant', true),
          ('00000000-0000-0000-0000-000000000005', NULL, 'lead', '项目内负责人', 'project', true),
          ('00000000-0000-0000-0000-000000000006', NULL, 'member', '项目成员', 'project', true)
      `);

      // 5. 插入系统角色默认权限
      // super_admin: 拥有所有资源的所有动作
      await queryRunner.query(`
        INSERT INTO "role_permissions" ("roleId", "resource", "action") VALUES
          -- super_admin 全权限
          ('00000000-0000-0000-0000-000000000001', 'users', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'users', 'create'),
          ('00000000-0000-0000-0000-000000000001', 'users', 'update'),
          ('00000000-0000-0000-0000-000000000001', 'users', 'delete'),
          ('00000000-0000-0000-0000-000000000001', 'roles', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'roles', 'create'),
          ('00000000-0000-0000-0000-000000000001', 'roles', 'update'),
          ('00000000-0000-0000-0000-000000000001', 'roles', 'delete'),
          ('00000000-0000-0000-0000-000000000001', 'projects', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'projects', 'create'),
          ('00000000-0000-0000-0000-000000000001', 'projects', 'update'),
          ('00000000-0000-0000-0000-000000000001', 'projects', 'delete'),
          ('00000000-0000-0000-0000-000000000001', 'tasks', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'tasks', 'create'),
          ('00000000-0000-0000-0000-000000000001', 'tasks', 'update'),
          ('00000000-0000-0000-0000-000000000001', 'tasks', 'delete'),
          ('00000000-0000-0000-0000-000000000001', 'points', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'points', 'approve'),
          ('00000000-0000-0000-0000-000000000001', 'votes', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'votes', 'create'),
          ('00000000-0000-0000-0000-000000000001', 'votes', 'close'),
          ('00000000-0000-0000-0000-000000000001', 'settlements', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'settlements', 'trigger'),
          ('00000000-0000-0000-0000-000000000001', 'dividends', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'dividends', 'create'),
          ('00000000-0000-0000-0000-000000000001', 'tenants', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'tenants', 'update'),
          ('00000000-0000-0000-0000-000000000001', 'config', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'config', 'update'),
          ('00000000-0000-0000-0000-000000000001', 'audit', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'bulletin', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'bulletin', 'update'),
          ('00000000-0000-0000-0000-000000000001', 'auctions', 'read'),
          ('00000000-0000-0000-0000-000000000001', 'auctions', 'create'),
          ('00000000-0000-0000-0000-000000000001', 'auctions', 'update'),
          ('00000000-0000-0000-0000-000000000001', 'auctions', 'delete'),
          -- hr_admin 权限
          ('00000000-0000-0000-0000-000000000002', 'users', 'read'),
          ('00000000-0000-0000-0000-000000000002', 'users', 'create'),
          ('00000000-0000-0000-0000-000000000002', 'users', 'update'),
          ('00000000-0000-0000-0000-000000000002', 'roles', 'read'),
          ('00000000-0000-0000-0000-000000000002', 'projects', 'read'),
          ('00000000-0000-0000-0000-000000000002', 'points', 'read'),
          ('00000000-0000-0000-0000-000000000002', 'points', 'approve'),
          ('00000000-0000-0000-0000-000000000002', 'audit', 'read'),
          ('00000000-0000-0000-0000-000000000002', 'bulletin', 'read'),
          -- project_lead 权限
          ('00000000-0000-0000-0000-000000000003', 'projects', 'read'),
          ('00000000-0000-0000-0000-000000000003', 'projects', 'create'),
          ('00000000-0000-0000-0000-000000000003', 'projects', 'update'),
          ('00000000-0000-0000-0000-000000000003', 'tasks', 'read'),
          ('00000000-0000-0000-0000-000000000003', 'tasks', 'create'),
          ('00000000-0000-0000-0000-000000000003', 'tasks', 'update'),
          ('00000000-0000-0000-0000-000000000003', 'tasks', 'delete'),
          ('00000000-0000-0000-0000-000000000003', 'votes', 'read'),
          ('00000000-0000-0000-0000-000000000003', 'votes', 'create'),
          ('00000000-0000-0000-0000-000000000003', 'votes', 'close'),
          ('00000000-0000-0000-0000-000000000003', 'settlements', 'read'),
          ('00000000-0000-0000-0000-000000000003', 'settlements', 'trigger'),
          ('00000000-0000-0000-0000-000000000003', 'points', 'read'),
          ('00000000-0000-0000-0000-000000000003', 'bulletin', 'read'),
          -- employee 权限
          ('00000000-0000-0000-0000-000000000004', 'projects', 'read'),
          ('00000000-0000-0000-0000-000000000004', 'projects', 'create'),
          ('00000000-0000-0000-0000-000000000004', 'tasks', 'read'),
          ('00000000-0000-0000-0000-000000000004', 'tasks', 'create'),
          ('00000000-0000-0000-0000-000000000004', 'votes', 'read'),
          ('00000000-0000-0000-0000-000000000004', 'votes', 'create'),
          ('00000000-0000-0000-0000-000000000004', 'points', 'read'),
          ('00000000-0000-0000-0000-000000000004', 'bulletin', 'read'),
          ('00000000-0000-0000-0000-000000000004', 'auctions', 'read'),
          ('00000000-0000-0000-0000-000000000004', 'auctions', 'create'),
          -- project lead (project scope) 权限
          ('00000000-0000-0000-0000-000000000005', 'tasks', 'read'),
          ('00000000-0000-0000-0000-000000000005', 'tasks', 'create'),
          ('00000000-0000-0000-0000-000000000005', 'tasks', 'update'),
          ('00000000-0000-0000-0000-000000000005', 'tasks', 'delete'),
          ('00000000-0000-0000-0000-000000000005', 'votes', 'read'),
          ('00000000-0000-0000-0000-000000000005', 'votes', 'create'),
          ('00000000-0000-0000-0000-000000000005', 'votes', 'close'),
          ('00000000-0000-0000-0000-000000000005', 'settlements', 'read'),
          ('00000000-0000-0000-0000-000000000005', 'settlements', 'trigger'),
          ('00000000-0000-0000-0000-000000000005', 'points', 'read'),
          -- project member 权限
          ('00000000-0000-0000-0000-000000000006', 'tasks', 'read'),
          ('00000000-0000-0000-0000-000000000006', 'tasks', 'create'),
          ('00000000-0000-0000-0000-000000000006', 'votes', 'read'),
          ('00000000-0000-0000-0000-000000000006', 'votes', 'create'),
          ('00000000-0000-0000-0000-000000000006', 'points', 'read')
      `);

      // 6. 迁移现有 users.role → user_roles
      // super_admin → 00000000-0000-0000-0000-000000000001
      // hr_admin    → 00000000-0000-0000-0000-000000000002
      // project_lead→ 00000000-0000-0000-0000-000000000003
      // employee    → 00000000-0000-0000-0000-000000000004
      await queryRunner.query(`
        INSERT INTO "user_roles" ("userId", "roleId")
        SELECT u."id",
          CASE u."role"
            WHEN 'super_admin'  THEN '00000000-0000-0000-0000-000000000001'::uuid
            WHEN 'hr_admin'     THEN '00000000-0000-0000-0000-000000000002'::uuid
            WHEN 'project_lead' THEN '00000000-0000-0000-0000-000000000003'::uuid
            ELSE                     '00000000-0000-0000-0000-000000000004'::uuid
          END
        FROM "users" u
        ON CONFLICT ("userId") DO NOTHING
      `);

      // 7. 为 project_members 添加 projectRoleId 列（默认 member 角色）
      await queryRunner.query(`
        ALTER TABLE "project_members"
        ADD COLUMN "projectRoleId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000006',
        ADD CONSTRAINT "FK_project_members_projectRoleId" FOREIGN KEY ("projectRoleId") REFERENCES "roles"("id") ON DELETE RESTRICT
      `);

      // 8. 删除 users.role 列和枚举类型
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
      await queryRunner.query(`DROP TYPE "users_role_enum"`);

      // 9. 创建 audit_logs 表
      await queryRunner.query(`
        CREATE TABLE "audit_logs" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenantId" uuid NOT NULL,
          "actorId" uuid,
          "actorName" character varying(100),
          "action" character varying(100) NOT NULL,
          "resource" character varying(100) NOT NULL,
          "resourceId" character varying(255),
          "previousData" jsonb,
          "newData" jsonb,
          "ipAddress" character varying(50),
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_tenantId" ON "audit_logs" ("tenantId")`);
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_tenantId_createdAt" ON "audit_logs" ("tenantId", "createdAt" DESC)`);
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actorId" ON "audit_logs" ("actorId")`);

      // 10. 创建 review_meetings 表
      await queryRunner.query(`
        CREATE TABLE "review_meetings" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenantId" uuid NOT NULL,
          "projectId" uuid NOT NULL,
          "createdBy" uuid NOT NULL,
          "status" character varying(20) NOT NULL DEFAULT 'open',
          "taskIds" jsonb NOT NULL DEFAULT '[]',
          "results" jsonb,
          "participantCount" integer NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "closedAt" TIMESTAMP,
          CONSTRAINT "PK_review_meetings" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_review_meetings_tenantId" ON "review_meetings" ("tenantId")`);
      await queryRunner.query(`CREATE INDEX "IDX_review_meetings_projectId" ON "review_meetings" ("projectId")`);

      // 11. 创建 review_votes 表
      await queryRunner.query(`
        CREATE TABLE "review_votes" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "meetingId" uuid NOT NULL,
          "taskId" uuid NOT NULL,
          "userId" uuid NOT NULL,
          "tenantId" uuid NOT NULL,
          "score" decimal(6,2),
          "isApproval" boolean NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_review_votes" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_review_votes_meeting_task_user" UNIQUE ("meetingId", "taskId", "userId"),
          CONSTRAINT "FK_review_votes_meetingId" FOREIGN KEY ("meetingId") REFERENCES "review_meetings"("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_review_votes_meetingId" ON "review_votes" ("meetingId")`);

      // 12. 创建 task_contributions 表
      await queryRunner.query(`
        CREATE TABLE "task_contributions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "taskId" uuid NOT NULL,
          "userId" uuid NOT NULL,
          "tenantId" uuid NOT NULL,
          "percentage" decimal(5,2) NOT NULL,
          "setInMeetingId" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_task_contributions" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_task_contributions_task_user" UNIQUE ("taskId", "userId"),
          CONSTRAINT "FK_task_contributions_meetingId" FOREIGN KEY ("setInMeetingId") REFERENCES "review_meetings"("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_task_contributions_taskId" ON "task_contributions" ("taskId")`);

      // 13. 创建 points_snapshots 表
      await queryRunner.query(`
        CREATE TABLE "points_snapshots" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenantId" uuid NOT NULL,
          "projectId" uuid NOT NULL,
          "settlementId" uuid NOT NULL,
          "userId" uuid NOT NULL,
          "userName" character varying(100) NOT NULL,
          "rawPoints" integer NOT NULL DEFAULT 0,
          "activePoints" integer NOT NULL DEFAULT 0,
          "rank" integer,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_points_snapshots" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_points_snapshots_tenantId_projectId" ON "points_snapshots" ("tenantId", "projectId")`);
      await queryRunner.query(`CREATE INDEX "IDX_points_snapshots_settlementId" ON "points_snapshots" ("settlementId")`);

      // 14. 创建 auctions 表
      await queryRunner.query(`
        CREATE TABLE "auctions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenantId" uuid NOT NULL,
          "type" character varying(20) NOT NULL,
          "targetEntity" character varying(100),
          "targetId" uuid,
          "description" text NOT NULL,
          "status" character varying(20) NOT NULL DEFAULT 'open',
          "minBid" integer NOT NULL DEFAULT 0,
          "endsAt" TIMESTAMP NOT NULL,
          "winnerId" uuid,
          "winningBid" integer,
          "createdBy" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_auctions" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_auctions_tenantId" ON "auctions" ("tenantId")`);
      await queryRunner.query(`CREATE INDEX "IDX_auctions_status_endsAt" ON "auctions" ("status", "endsAt")`);

      // 15. 创建 bids 表
      await queryRunner.query(`
        CREATE TABLE "bids" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "auctionId" uuid NOT NULL,
          "userId" uuid NOT NULL,
          "tenantId" uuid NOT NULL,
          "amount" integer NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_bids" PRIMARY KEY ("id"),
          CONSTRAINT "FK_bids_auctionId" FOREIGN KEY ("auctionId") REFERENCES "auctions"("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_bids_auctionId" ON "bids" ("auctionId")`);
      await queryRunner.query(`CREATE INDEX "IDX_bids_userId_tenantId" ON "bids" ("userId", "tenantId")`);

      // 16. 添加 pending_review 到 task status enum
      // PostgreSQL 不支持在事务中 ALTER TYPE ADD VALUE
      // 方案：先转为 varchar → 更新数据 → 重建 enum（含新值）→ 转回 enum
      await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "status" TYPE character varying(30)`);
      await queryRunner.query(`UPDATE "tasks" SET "status" = 'pending_review' WHERE "status" = 'pending_vote'`);
      await queryRunner.query(`DROP TYPE IF EXISTS "tasks_status_enum" CASCADE`);
      await queryRunner.query(`CREATE TYPE "tasks_status_enum" AS ENUM ('open', 'claimed', 'submitted', 'ai_reviewing', 'pending_review', 'pending_vote', 'settled', 'cancelled')`);
      await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "tasks_status_enum" USING "status"::"tasks_status_enum"`);

      // 17. 为 tasks 添加 claimMode 列
      await queryRunner.query(`
        ALTER TABLE "tasks"
        ADD COLUMN "claimMode" character varying(20) NOT NULL DEFAULT 'single'
      `);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // 还原 tasks 状态
      await queryRunner.query(`UPDATE "tasks" SET "status" = 'pending_vote' WHERE "status" = 'pending_review'`);

      // 删除 tasks 新列
      await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "claimMode"`);

      // 删除 bids
      await queryRunner.query(`DROP TABLE IF EXISTS "bids"`);

      // 删除 auctions
      await queryRunner.query(`DROP TABLE IF EXISTS "auctions"`);

      // 删除 points_snapshots
      await queryRunner.query(`DROP TABLE IF EXISTS "points_snapshots"`);

      // 删除 task_contributions
      await queryRunner.query(`DROP TABLE IF EXISTS "task_contributions"`);

      // 删除 review_votes
      await queryRunner.query(`DROP TABLE IF EXISTS "review_votes"`);

      // 删除 review_meetings
      await queryRunner.query(`DROP TABLE IF EXISTS "review_meetings"`);

      // 删除 audit_logs
      await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);

      // 还原 users.role 列
      await queryRunner.query(`
        CREATE TYPE "users_role_enum" AS ENUM (
          'super_admin', 'hr_admin', 'project_lead', 'employee'
        )
      `);
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD COLUMN "role" "users_role_enum" NOT NULL DEFAULT 'employee'
      `);

      // 从 user_roles 还原角色数据
      await queryRunner.query(`
        UPDATE "users" u
        SET "role" = CASE r."name"
          WHEN 'super_admin'  THEN 'super_admin'::"users_role_enum"
          WHEN 'hr_admin'     THEN 'hr_admin'::"users_role_enum"
          WHEN 'project_lead' THEN 'project_lead'::"users_role_enum"
          ELSE                     'employee'::"users_role_enum"
        END
        FROM "user_roles" ur
        JOIN "roles" r ON r."id" = ur."roleId"
        WHERE u."id" = ur."userId"
      `);

      // 删除 project_members.projectRoleId
      await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT IF EXISTS "FK_project_members_projectRoleId"`);
      await queryRunner.query(`ALTER TABLE "project_members" DROP COLUMN IF EXISTS "projectRoleId"`);

      // 删除 user_roles
      await queryRunner.query(`DROP TABLE IF EXISTS "user_roles"`);

      // 删除 role_permissions
      await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);

      // 删除 roles
      await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }

    // pending_review 枚举值无法从 PostgreSQL enum 中删除（不支持 DROP VALUE）
    // 只能通过重建 enum 来移除，此处留空
  }
}
