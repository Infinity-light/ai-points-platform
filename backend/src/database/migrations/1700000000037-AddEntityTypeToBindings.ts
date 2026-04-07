import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEntityTypeToBindings1700000000037 implements MigrationInterface {
  name = 'AddEntityTypeToBindings1700000000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── feishu_bitable_bindings: add new columns ──────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "feishu_bitable_bindings"
        ADD COLUMN "entityType" varchar(50) NOT NULL DEFAULT 'task',
        ADD COLUMN "syncDirection" varchar(20) NOT NULL DEFAULT 'bidirectional',
        ADD COLUMN "conflictStrategy" varchar(20) NOT NULL DEFAULT 'last_write_wins',
        ADD COLUMN "isActive" boolean NOT NULL DEFAULT true
    `);

    // Drop the old unique constraint on (tenantId, projectId) — it was created as a named UNIQUE constraint
    await queryRunner.query(`
      ALTER TABLE "feishu_bitable_bindings"
        DROP CONSTRAINT IF EXISTS "UQ_feishu_bitable_bindings_tenant_project"
    `);

    // Create new unique index on (tenantId, projectId, entityType)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_feishu_bitable_bindings_tenant_project_entity"
        ON "feishu_bitable_bindings" ("tenantId", "projectId", "entityType")
    `);

    // ─── feishu_bitable_records: add new columns ──────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "feishu_bitable_records"
        ADD COLUMN "entityType" varchar(50) NOT NULL DEFAULT 'task',
        ADD COLUMN "entityId" uuid,
        ADD COLUMN "bitableUpdatedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore feishu_bitable_records columns
    await queryRunner.query(`
      ALTER TABLE "feishu_bitable_records"
        DROP COLUMN IF EXISTS "bitableUpdatedAt",
        DROP COLUMN IF EXISTS "entityId",
        DROP COLUMN IF EXISTS "entityType"
    `);

    // Drop new unique index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_feishu_bitable_bindings_tenant_project_entity"
    `);

    // Restore old unique constraint
    await queryRunner.query(`
      ALTER TABLE "feishu_bitable_bindings"
        ADD CONSTRAINT "UQ_feishu_bitable_bindings_tenant_project" UNIQUE ("tenantId", "projectId")
    `);

    // Drop new columns from feishu_bitable_bindings
    await queryRunner.query(`
      ALTER TABLE "feishu_bitable_bindings"
        DROP COLUMN IF EXISTS "isActive",
        DROP COLUMN IF EXISTS "conflictStrategy",
        DROP COLUMN IF EXISTS "syncDirection",
        DROP COLUMN IF EXISTS "entityType"
    `);
  }
}
