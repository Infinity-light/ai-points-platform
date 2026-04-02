import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropInviteTables1700000000034 implements MigrationInterface {
  name = 'DropInviteTables1700000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invite_usages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invite_codes"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invite_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "code" varchar(64) NOT NULL,
        "createdBy" uuid NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "maxUses" integer,
        "usedCount" integer NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invite_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invite_codes_code_tenant" UNIQUE ("code", "tenantId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "invite_usages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inviteCodeId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "usedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invite_usages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invite_usages_code" FOREIGN KEY ("inviteCodeId") REFERENCES "invite_codes"("id")
      )
    `);
  }
}
