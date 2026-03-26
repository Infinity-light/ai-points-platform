import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrainConversations1700000000012 implements MigrationInterface {
  name = 'CreateBrainConversations1700000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "brain_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "messages" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_brain_conversations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_brain_conversations_tenant_project_user" ON "brain_conversations" ("tenantId", "projectId", "userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "brain_conversations"`);
  }
}
