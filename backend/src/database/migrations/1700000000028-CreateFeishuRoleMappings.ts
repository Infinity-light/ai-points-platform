import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeishuRoleMappings1700000000028 implements MigrationInterface {
  name = 'CreateFeishuRoleMappings1700000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feishu_role_mappings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "feishuRoleName" character varying(100) NOT NULL,
        "platformRoleId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feishu_role_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feishu_role_mappings_tenant_role" UNIQUE ("tenantId", "feishuRoleName")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_feishu_role_mappings_tenantId" ON "feishu_role_mappings" ("tenantId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "feishu_role_mappings"`);
  }
}
