import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssets1700000000041 implements MigrationInterface {
  name = 'CreateAssets1700000000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "assetCode" varchar(50) NOT NULL,
        "name" varchar(200) NOT NULL,
        "assetType" varchar(20) NOT NULL,
        "category" varchar(50) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'pending_acceptance',
        "purchasePrice" decimal(12,2),
        "usefulLifeMonths" int,
        "residualValue" decimal(12,2),
        "purchaseDate" date,
        "vendor" varchar(200),
        "serialNumber" varchar(200),
        "expiresAt" timestamp,
        "assignedUserId" uuid,
        "departmentId" uuid,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "feishuRecordId" varchar(200),
        "notes" text,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_assets_tenant_assetCode" UNIQUE ("tenantId", "assetCode")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_assets_tenantId" ON "assets" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_assets_assignedUserId" ON "assets" ("assignedUserId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_assets_status" ON "assets" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "asset_operations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "assetId" uuid NOT NULL,
        "operationType" varchar(30) NOT NULL,
        "fromUserId" uuid,
        "toUserId" uuid,
        "approvalInstanceId" uuid,
        "notes" text,
        "operatedBy" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset_operations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_asset_operations_asset" FOREIGN KEY ("assetId")
          REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_asset_operations_tenantId" ON "asset_operations" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_asset_operations_assetId" ON "asset_operations" ("assetId")
    `);

    await queryRunner.query(`
      CREATE TABLE "asset_code_sequences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "category" varchar(50) NOT NULL,
        "year" int NOT NULL,
        "lastSeq" int NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset_code_sequences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_asset_code_sequences_tenant_category_year" UNIQUE ("tenantId", "category", "year")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_code_sequences"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_operations_assetId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_operations_tenantId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_operations"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assets_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assets_assignedUserId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assets_tenantId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assets"`);
  }
}
