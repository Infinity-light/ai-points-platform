import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjects1700000000004 implements MigrationInterface {
  name = 'CreateProjects1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "projects_status_enum" AS ENUM ('active', 'archived')
    `);
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "description" text,
        "status" "projects_status_enum" NOT NULL DEFAULT 'active',
        "annealingConfig" jsonb NOT NULL DEFAULT '{"cyclesPerStep":3,"maxSteps":9}',
        "settlementConfig" jsonb NOT NULL DEFAULT '{"periodType":"weekly","dayOfWeek":1}',
        "createdBy" uuid NOT NULL,
        "settlementRound" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_projects_tenantId" ON "projects" ("tenantId")`);

    await queryRunner.query(`
      CREATE TABLE "project_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_members_project_user" UNIQUE ("projectId", "userId")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_project_members_tenantId_projectId" ON "project_members" ("tenantId", "projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_project_members_userId" ON "project_members" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "project_members"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "projects_status_enum"`);
  }
}
