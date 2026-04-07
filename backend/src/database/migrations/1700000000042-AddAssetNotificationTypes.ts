import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssetNotificationTypes1700000000042 implements MigrationInterface {
  name = 'AddAssetNotificationTypes1700000000042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ALTER TYPE ... ADD VALUE cannot run inside a transaction.
    // Commit any auto-opened transaction first, then re-open at the end.
    await queryRunner.query('COMMIT');

    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'ASSET_EXPIRY_REMINDER'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'ASSET_OPERATION_APPROVED'`,
    );

    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values.
    // No-op: enum values ASSET_EXPIRY_REMINDER, ASSET_OPERATION_APPROVED remain.
  }
}
