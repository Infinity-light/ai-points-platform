import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceToAuditLogs1700000000025 implements MigrationInterface {
  name = 'AddSourceToAuditLogs1700000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'jwt'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS source`);
  }
}
