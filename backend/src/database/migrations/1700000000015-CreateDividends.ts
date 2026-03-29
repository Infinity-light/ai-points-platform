import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDividends1700000000015 implements MigrationInterface {
  name = 'CreateDividends1700000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "dividend_status_enum" AS ENUM (
        'draft',
        'pending_approval',
        'approved',
        'rejected'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "dividends" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "settlementId" uuid NOT NULL,
        "roundNumber" integer NOT NULL,
        "totalAmount" double precision,
        "totalActivePoints" double precision NOT NULL,
        "details" jsonb NOT NULL DEFAULT '{}',
        "status" "dividend_status_enum" NOT NULL DEFAULT 'draft',
        "approvedBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dividends" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_dividends_tenantId" ON "dividends" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_dividends_projectId" ON "dividends" ("projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_dividends_tenantId_projectId" ON "dividends" ("tenantId", "projectId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_dividends_tenantId_projectId"`);
    await queryRunner.query(`DROP INDEX "IDX_dividends_projectId"`);
    await queryRunner.query(`DROP INDEX "IDX_dividends_tenantId"`);
    await queryRunner.query(`DROP TABLE "dividends"`);
    await queryRunner.query(`DROP TYPE "dividend_status_enum"`);
  }
}
