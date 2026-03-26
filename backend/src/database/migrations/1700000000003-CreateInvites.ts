import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvites1700000000003 implements MigrationInterface {
  name = 'CreateInvites1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "code" character varying(64) NOT NULL,
        "maxUses" integer NOT NULL DEFAULT 1,
        "usedCount" integer NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        "note" character varying(255),
        "createdBy" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invites_tenant_code" UNIQUE ("tenantId", "code")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invites_tenantId" ON "invites" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invites_code" ON "invites" ("code")
    `);

    await queryRunner.query(`
      CREATE TABLE "invite_usages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inviteId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "usedBy" uuid NOT NULL,
        "usedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invite_usages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invite_usages_inviteId" ON "invite_usages" ("inviteId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invite_usages_tenantId" ON "invite_usages" ("tenantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "invite_usages"`);
    await queryRunner.query(`DROP TABLE "invites"`);
  }
}
