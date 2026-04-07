import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalNotificationTypes1700000000040 implements MigrationInterface {
  name = 'AddApprovalNotificationTypes1700000000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ALTER TYPE ... ADD VALUE cannot run inside a transaction.
    // Commit any auto-opened transaction first, then re-open at the end.
    await queryRunner.query('COMMIT');

    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'APPROVAL_REQUESTED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'APPROVAL_COMPLETED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'APPROVAL_REJECTED'`,
    );

    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values.
    // No-op: enum values APPROVAL_REQUESTED, APPROVAL_COMPLETED, APPROVAL_REJECTED remain.
  }
}
