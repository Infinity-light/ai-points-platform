import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSkills1700000000016 implements MigrationInterface {
  name = 'CreateSkills1700000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "skill_status_enum" AS ENUM (
        'active',
        'deprecated'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "skills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "category" character varying,
        "version" integer NOT NULL DEFAULT 1,
        "authorId" uuid NOT NULL,
        "content" text NOT NULL,
        "repoUrl" character varying,
        "latestSubmissionId" uuid,
        "status" "skill_status_enum" NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skills" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_skills_tenantId_projectId_name" UNIQUE ("tenantId", "projectId", "name")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_skills_tenantId" ON "skills" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_skills_projectId" ON "skills" ("projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_skills_tenantId_projectId" ON "skills" ("tenantId", "projectId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_skills_tenantId_projectId"`);
    await queryRunner.query(`DROP INDEX "IDX_skills_projectId"`);
    await queryRunner.query(`DROP INDEX "IDX_skills_tenantId"`);
    await queryRunner.query(`DROP TABLE "skills"`);
    await queryRunner.query(`DROP TYPE "skill_status_enum"`);
  }
}
