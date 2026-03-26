import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasks1700000000005 implements MigrationInterface {
  name = 'CreateTasks1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "tasks_status_enum" AS ENUM (
        'open', 'claimed', 'submitted', 'ai_reviewing', 'pending_vote', 'settled', 'cancelled'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "title" character varying(500) NOT NULL,
        "description" text,
        "status" "tasks_status_enum" NOT NULL DEFAULT 'open',
        "assigneeId" uuid,
        "createdBy" uuid NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "estimatedPoints" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_tenantId_projectId" ON "tasks" ("tenantId", "projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_assigneeId" ON "tasks" ("assigneeId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TYPE "tasks_status_enum"`);
  }
}
