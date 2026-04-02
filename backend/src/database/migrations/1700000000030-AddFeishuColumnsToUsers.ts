import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeishuColumnsToUsers1700000000030 implements MigrationInterface {
  name = 'AddFeishuColumnsToUsers1700000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "feishuOpenId" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "feishuUnionId" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "departmentId" uuid`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_tenantId_feishuOpenId" ON "users" ("tenantId", "feishuOpenId") WHERE "feishuOpenId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_tenantId_feishuOpenId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "departmentId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "feishuUnionId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "feishuOpenId"`);
  }
}
