import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeishuConfigs1700000000027 implements MigrationInterface {
  name = 'CreateFeishuConfigs1700000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feishu_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "appId" character varying(100) NOT NULL,
        "encryptedAppSecret" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "webhookVerifyToken" character varying(100),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feishu_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feishu_configs_tenantId" UNIQUE ("tenantId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "feishu_configs"`);
  }
}
