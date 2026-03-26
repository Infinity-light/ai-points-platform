import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubmissions1700000000007 implements MigrationInterface {
  name = 'CreateSubmissions1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "submissions_type_enum" AS ENUM ('explore', 'ai-exec', 'manual')
    `);
    await queryRunner.query(`
      CREATE TABLE "submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "taskId" uuid NOT NULL,
        "submittedBy" uuid NOT NULL,
        "type" "submissions_type_enum" NOT NULL,
        "content" text NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "aiReviewStatus" character varying NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_submissions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_submissions_tenantId_taskId" ON "submissions" ("tenantId", "taskId")`);
    await queryRunner.query(`CREATE INDEX "IDX_submissions_taskId" ON "submissions" ("taskId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "submissions"`);
    await queryRunner.query(`DROP TYPE "submissions_type_enum"`);
  }
}
