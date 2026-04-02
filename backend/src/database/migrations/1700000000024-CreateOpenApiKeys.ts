import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOpenApiKeys1700000000024 implements MigrationInterface {
  name = 'CreateOpenApiKeys1700000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS open_api_keys (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId"   UUID NOT NULL,
        label        VARCHAR(100) NOT NULL,
        "keyHash"    VARCHAR(64) NOT NULL UNIQUE,
        "keyPrefix"  VARCHAR(10) NOT NULL,
        "isActive"   BOOLEAN NOT NULL DEFAULT true,
        "expiresAt"  TIMESTAMPTZ,
        "lastUsedAt" TIMESTAMPTZ,
        "createdBy"  UUID NOT NULL,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_open_api_keys_tenantId" ON open_api_keys ("tenantId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS open_api_keys`);
  }
}
