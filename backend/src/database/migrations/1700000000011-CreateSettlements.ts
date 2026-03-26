import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSettlements1700000000011 implements MigrationInterface {
  name = 'CreateSettlements1700000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "settlements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "roundNumber" integer NOT NULL,
        "triggeredBy" uuid NOT NULL,
        "voteSessionId" uuid NOT NULL,
        "settledTaskIds" jsonb NOT NULL DEFAULT '[]',
        "summary" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settlements" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_settlements_tenantId_projectId" ON "settlements" ("tenantId", "projectId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "settlements"`);
  }
}
