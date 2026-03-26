import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePoints1700000000009 implements MigrationInterface {
  name = 'CreatePoints1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "point_records_source_enum" AS ENUM ('task_settlement', 'adjustment')
    `);
    await queryRunner.query(`
      CREATE TABLE "point_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "originalPoints" integer NOT NULL,
        "acquiredRound" integer NOT NULL,
        "source" "point_records_source_enum" NOT NULL DEFAULT 'task_settlement',
        "taskId" uuid,
        "voteSessionId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_point_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_point_records_tenant_user_project" ON "point_records" ("tenantId", "userId", "projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_point_records_userId" ON "point_records" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_point_records_projectId" ON "point_records" ("projectId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "point_records"`);
    await queryRunner.query(`DROP TYPE "point_records_source_enum"`);
  }
}
