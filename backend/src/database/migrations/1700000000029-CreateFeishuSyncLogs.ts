import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeishuSyncLogs1700000000029 implements MigrationInterface {
  name = 'CreateFeishuSyncLogs1700000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feishu_sync_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "type" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "stats" jsonb NOT NULL DEFAULT '{}',
        "error" text,
        "startedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        CONSTRAINT "PK_feishu_sync_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_feishu_sync_logs_tenantId_startedAt" ON "feishu_sync_logs" ("tenantId", "startedAt" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "feishu_sync_logs"`);
  }
}
