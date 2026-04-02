import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBitableBindings1700000000035 implements MigrationInterface {
  name = 'CreateBitableBindings1700000000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feishu_bitable_bindings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "appToken" varchar(200) NOT NULL,
        "tableId" varchar(200) NOT NULL,
        "fieldMapping" jsonb NOT NULL DEFAULT '{}',
        "writebackFieldId" varchar(200),
        "syncStatus" varchar(20) NOT NULL DEFAULT 'idle',
        "lastSyncAt" TIMESTAMP,
        "lastSyncError" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feishu_bitable_bindings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feishu_bitable_bindings_tenant_project" UNIQUE ("tenantId", "projectId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feishu_bitable_bindings_tenantId" ON "feishu_bitable_bindings" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE TABLE "feishu_bitable_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bindingId" uuid NOT NULL,
        "feishuRecordId" varchar(200) NOT NULL,
        "taskId" uuid,
        "lastEventId" varchar(200),
        "lastSyncAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feishu_bitable_records" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feishu_bitable_records_binding_record" UNIQUE ("bindingId", "feishuRecordId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feishu_bitable_records_bindingId" ON "feishu_bitable_records" ("bindingId")
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks" ADD COLUMN "feishuRecordId" varchar(200)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_feishuRecordId" ON "tasks" ("feishuRecordId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_feishuRecordId"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "feishuRecordId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feishu_bitable_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feishu_bitable_bindings"`);
  }
}
