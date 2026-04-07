import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReimbursementNotificationTypes1700000000044 implements MigrationInterface {
  name = 'AddReimbursementNotificationTypes1700000000044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ALTER TYPE ... ADD VALUE cannot run inside a transaction.
    // Commit any auto-opened transaction first, then re-open at the end.
    await queryRunner.query('COMMIT');

    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'REIMBURSEMENT_SUBMITTED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'REIMBURSEMENT_APPROVED'`,
    );

    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values.
    // No-op: enum values REIMBURSEMENT_SUBMITTED, REIMBURSEMENT_APPROVED remain.
  }
}
