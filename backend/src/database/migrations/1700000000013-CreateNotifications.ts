import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1700000000013 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TYPE notification_type_enum AS ENUM (
        'TASK_ASSIGNED', 'TASK_SCORE_READY', 'VOTE_STARTED',
        'POINTS_AWARDED', 'SETTLEMENT_COMPLETE'
      )
    `);
    await runner.query(`
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "tenantId" UUID NOT NULL,
        type notification_type_enum NOT NULL,
        title VARCHAR(200) NOT NULL,
        content VARCHAR(500) NOT NULL,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        metadata JSONB,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await runner.query(`CREATE INDEX idx_notifications_user_read ON notifications ("userId", "isRead")`);
    await runner.query(`CREATE INDEX idx_notifications_user ON notifications ("userId")`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE IF EXISTS notifications`);
    await runner.query(`DROP TYPE IF EXISTS notification_type_enum`);
  }
}
