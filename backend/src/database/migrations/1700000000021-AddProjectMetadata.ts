import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectMetadata1700000000021 implements MigrationInterface {
  name = 'AddProjectMetadata1700000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects DROP COLUMN metadata
    `);
  }
}
