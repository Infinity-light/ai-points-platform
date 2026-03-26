import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookLogs1700000000008 implements MigrationInterface {
  name = 'CreateWebhookLogs1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhook_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "taskId" uuid,
        "commitHash" character varying(100) NOT NULL,
        "commitMessage" text NOT NULL,
        "repoUrl" character varying(500) NOT NULL,
        "commitUrl" character varying(500) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'processing',
        "note" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_logs_tenantId" ON "webhook_logs" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_logs_taskId" ON "webhook_logs" ("taskId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook_logs"`);
  }
}
