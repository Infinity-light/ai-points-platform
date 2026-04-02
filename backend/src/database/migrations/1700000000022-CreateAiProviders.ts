import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiProviders1700000000022 implements MigrationInterface {
  name = 'CreateAiProviders1700000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_providers (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId"  UUID NOT NULL,
        name        VARCHAR(100) NOT NULL,
        type        VARCHAR(50)  NOT NULL,
        "baseUrl"   VARCHAR(500),
        "isActive"  BOOLEAN NOT NULL DEFAULT true,
        config      JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_providers_tenantId" ON ai_providers ("tenantId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_providers`);
  }
}
