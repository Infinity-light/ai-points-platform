import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiProviderKeys1700000000023 implements MigrationInterface {
  name = 'CreateAiProviderKeys1700000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_provider_keys (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId"     UUID NOT NULL,
        "providerId"   UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
        label          VARCHAR(100) NOT NULL,
        "encryptedKey" TEXT NOT NULL,
        model          VARCHAR(100),
        "isActive"     BOOLEAN NOT NULL DEFAULT true,
        "lastUsedAt"   TIMESTAMPTZ,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_provider_keys_tenantId" ON ai_provider_keys ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_provider_keys_providerId" ON ai_provider_keys ("providerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_provider_keys`);
  }
}
