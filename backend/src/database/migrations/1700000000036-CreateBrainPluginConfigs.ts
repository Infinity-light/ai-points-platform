import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrainPluginConfigs1700000000036 implements MigrationInterface {
  name = 'CreateBrainPluginConfigs1700000000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "brain_plugin_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "pluginId" varchar(128) NOT NULL,
        "type" varchar(32) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "config" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_brain_plugin_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_brain_plugin_configs_tenant_plugin" UNIQUE ("tenantId", "pluginId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_brain_plugin_configs_tenantId" ON "brain_plugin_configs" ("tenantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "brain_plugin_configs"`);
  }
}
