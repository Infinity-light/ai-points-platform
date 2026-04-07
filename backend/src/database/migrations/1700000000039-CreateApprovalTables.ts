import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApprovalTables1700000000039 implements MigrationInterface {
  name = 'CreateApprovalTables1700000000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "approval_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "configType" varchar(50) NOT NULL,
        "deptApproverMode" varchar(20) NOT NULL DEFAULT 'department_head',
        "financePersonId" uuid,
        "finalApproverId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_approval_configs_tenant_type" UNIQUE ("tenantId", "configType")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_approval_configs_tenantId" ON "approval_configs" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE TABLE "approval_instances" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "businessType" varchar(50) NOT NULL,
        "businessId" uuid NOT NULL,
        "submitterId" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "currentStep" int NOT NULL DEFAULT 1,
        "step1ApproverId" uuid,
        "step2ApproverId" uuid,
        "step3ApproverId" uuid,
        "completedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_instances" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_approval_instances_tenantId" ON "approval_instances" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_approval_instances_submitterId" ON "approval_instances" ("submitterId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_approval_instances_businessType_businessId" ON "approval_instances" ("businessType", "businessId")
    `);

    await queryRunner.query(`
      CREATE TABLE "approval_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "instanceId" uuid NOT NULL,
        "approverId" uuid NOT NULL,
        "step" int NOT NULL,
        "action" varchar(20) NOT NULL,
        "comment" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_approval_records_instance" FOREIGN KEY ("instanceId")
          REFERENCES "approval_instances"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_approval_records_instanceId" ON "approval_records" ("instanceId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_records_instanceId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_records"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_instances_businessType_businessId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_instances_submitterId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_instances_tenantId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_instances"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_configs_tenantId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_configs"`);
  }
}
