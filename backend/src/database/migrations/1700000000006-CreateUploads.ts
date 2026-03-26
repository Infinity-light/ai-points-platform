import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUploads1700000000006 implements MigrationInterface {
  name = 'CreateUploads1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "uploads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "uploadedBy" uuid NOT NULL,
        "originalName" character varying(500) NOT NULL,
        "mimeType" character varying(200) NOT NULL,
        "size" integer NOT NULL,
        "storagePath" character varying(1000) NOT NULL,
        "publicUrl" character varying(1000) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_uploads" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_uploads_tenantId" ON "uploads" ("tenantId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "uploads"`);
  }
}
