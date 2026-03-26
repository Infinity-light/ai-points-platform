import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVoteSessions1700000000010 implements MigrationInterface {
  name = 'CreateVoteSessions1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "vote_sessions_status_enum" AS ENUM ('open', 'closed', 'passed', 'failed')
    `);
    await queryRunner.query(`
      CREATE TABLE "vote_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "status" "vote_sessions_status_enum" NOT NULL DEFAULT 'open',
        "createdBy" uuid NOT NULL,
        "taskIds" jsonb NOT NULL DEFAULT '[]',
        "result" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vote_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_vote_sessions_tenantId_projectId" ON "vote_sessions" ("tenantId", "projectId")`);

    await queryRunner.query(`
      CREATE TABLE "vote_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "voteSessionId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "vote" boolean NOT NULL,
        "weight" decimal(10,4) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vote_records" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vote_records_session_user" UNIQUE ("voteSessionId", "userId")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_vote_records_voteSessionId" ON "vote_records" ("voteSessionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_vote_records_userId" ON "vote_records" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "vote_records"`);
    await queryRunner.query(`DROP TABLE "vote_sessions"`);
    await queryRunner.query(`DROP TYPE "vote_sessions_status_enum"`);
  }
}
