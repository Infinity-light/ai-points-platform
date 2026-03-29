import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePointApprovalBatch1700000000017 implements MigrationInterface {
  name = 'CreatePointApprovalBatch1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "point_approval_batch_status_enum" AS ENUM (
        'pending',
        'approved',
        'rejected'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "point_approval_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "submittedBy" uuid NOT NULL,
        "pointRecordIds" jsonb NOT NULL DEFAULT '[]',
        "totalPoints" double precision NOT NULL,
        "status" "point_approval_batch_status_enum" NOT NULL DEFAULT 'pending',
        "reviewedBy" uuid,
        "reviewNote" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_point_approval_batches" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_point_approval_batches_tenantId" ON "point_approval_batches" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_point_approval_batches_projectId" ON "point_approval_batches" ("projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_point_approval_batches_tenantId_projectId" ON "point_approval_batches" ("tenantId", "projectId")`);

    await queryRunner.query(`
      CREATE TYPE "pool_status_enum" AS ENUM (
        'project_only',
        'pending_approval',
        'approved'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "point_records"
      ADD COLUMN "poolStatus" "pool_status_enum" NOT NULL DEFAULT 'approved'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "point_records" DROP COLUMN "poolStatus"`);
    await queryRunner.query(`DROP TYPE "pool_status_enum"`);
    await queryRunner.query(`DROP INDEX "IDX_point_approval_batches_tenantId_projectId"`);
    await queryRunner.query(`DROP INDEX "IDX_point_approval_batches_projectId"`);
    await queryRunner.query(`DROP INDEX "IDX_point_approval_batches_tenantId"`);
    await queryRunner.query(`DROP TABLE "point_approval_batches"`);
    await queryRunner.query(`DROP TYPE "point_approval_batch_status_enum"`);
  }
}
