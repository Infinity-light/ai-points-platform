import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropApprovalBatches1700000000033 implements MigrationInterface {
  name = 'DropApprovalBatches1700000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "point_approval_batches"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "point_approval_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "submittedBy" uuid NOT NULL,
        "pointRecordIds" jsonb NOT NULL DEFAULT '[]',
        "totalPoints" integer NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'pending',
        "reviewedBy" uuid,
        "reviewNote" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_point_approval_batches" PRIMARY KEY ("id")
      )
    `);
  }
}
