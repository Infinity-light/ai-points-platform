import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1700000000002 implements MigrationInterface {
  name = 'CreateUsers1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "users_role_enum" AS ENUM (
        'super_admin', 'hr_admin', 'project_lead', 'employee'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "email" character varying(255) NOT NULL,
        "passwordHash" character varying NOT NULL,
        "phone" character varying(20),
        "name" character varying(100) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'employee',
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "emailVerificationCode" character varying,
        "emailVerificationExpiry" TIMESTAMP,
        "refreshToken" character varying,
        "inviteCodeUsed" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_tenantId_email" ON "users" ("tenantId", "email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_tenantId" ON "users" ("tenantId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_tenantId"`);
    await queryRunner.query(`DROP INDEX "IDX_users_tenantId_email"`);
    await queryRunner.query(`DROP INDEX "IDX_users_tenantId"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}
