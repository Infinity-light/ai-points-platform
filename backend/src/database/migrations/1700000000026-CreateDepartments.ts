import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartments1700000000026 implements MigrationInterface {
  name = 'CreateDepartments1700000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "departments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "feishuDeptId" character varying(100),
        "parentId" uuid,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "memberCount" integer NOT NULL DEFAULT 0,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_departments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_departments_tenantId" ON "departments" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_departments_parentId" ON "departments" ("parentId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_departments_tenantId_feishuDeptId" ON "departments" ("tenantId", "feishuDeptId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "departments"`);
  }
}
