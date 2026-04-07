import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBitableSyncLogs1700000000038 implements MigrationInterface {
  name = 'CreateBitableSyncLogs1700000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bitable_sync_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "bindingId" uuid NOT NULL,
        "syncType" varchar(20) NOT NULL,
        "direction" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'running',
        "recordsProcessed" int NOT NULL DEFAULT 0,
        "recordsCreated" int NOT NULL DEFAULT 0,
        "recordsUpdated" int NOT NULL DEFAULT 0,
        "recordsFailed" int NOT NULL DEFAULT 0,
        "errorMessage" text,
        "startedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        CONSTRAINT "PK_bitable_sync_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bitable_sync_logs_binding" FOREIGN KEY ("bindingId")
          REFERENCES "feishu_bitable_bindings"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bitable_sync_logs_tenantId" ON "bitable_sync_logs" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bitable_sync_logs_bindingId" ON "bitable_sync_logs" ("bindingId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bitable_sync_logs_bindingId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bitable_sync_logs_tenantId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bitable_sync_logs"`);
  }
}
