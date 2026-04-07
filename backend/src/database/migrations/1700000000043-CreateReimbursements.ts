import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReimbursements1700000000043 implements MigrationInterface {
  name = 'CreateReimbursements1700000000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reimbursements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "submitterId" uuid NOT NULL,
        "reimbursementType" varchar(30) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'draft',
        "title" varchar(200) NOT NULL,
        "totalAmount" decimal(12,2) NOT NULL DEFAULT 0,
        "linkedAssetId" uuid,
        "approvalInstanceId" uuid,
        "paidAt" timestamp,
        "paymentReference" varchar(200),
        "notes" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reimbursements" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reimbursements_tenantId" ON "reimbursements" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reimbursements_submitterId" ON "reimbursements" ("submitterId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reimbursements_status" ON "reimbursements" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "reimbursement_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reimbursementId" uuid NOT NULL,
        "description" varchar(500) NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "expenseDate" date NOT NULL,
        "receiptUploadIds" jsonb NOT NULL DEFAULT '[]',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reimbursement_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reimbursement_items_reimbursement" FOREIGN KEY ("reimbursementId")
          REFERENCES "reimbursements"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reimbursement_items_reimbursementId" ON "reimbursement_items" ("reimbursementId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reimbursement_items_reimbursementId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reimbursement_items"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reimbursements_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reimbursements_submitterId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reimbursements_tenantId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reimbursements"`);
  }
}
