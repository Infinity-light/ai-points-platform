import { MigrationInterface, QueryRunner } from 'typeorm';

export class SettlementModeConfig1700000000019 implements MigrationInterface {
  name = 'SettlementModeConfig1700000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Migrate existing settlementConfig from { periodType, dayOfWeek/dayOfMonth }
    // to { mode: 'manual' } for all projects.
    // Since we cleared the DB, this is mostly a safety net for future deployments.
    await queryRunner.query(`
      UPDATE projects
      SET "settlementConfig" = jsonb_build_object(
        'mode', 'manual',
        'schedule', CASE
          WHEN "settlementConfig"->>'periodType' IS NOT NULL
          THEN jsonb_build_object(
            'periodType', "settlementConfig"->>'periodType',
            'dayOfWeek', ("settlementConfig"->>'dayOfWeek')::int,
            'dayOfMonth', ("settlementConfig"->>'dayOfMonth')::int
          )
          ELSE NULL
        END
      )
      WHERE "settlementConfig"->>'mode' IS NULL
    `);

    // Update the column default for new projects
    await queryRunner.query(`
      ALTER TABLE projects
      ALTER COLUMN "settlementConfig"
      SET DEFAULT '{"mode":"manual"}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to legacy format
    await queryRunner.query(`
      UPDATE projects
      SET "settlementConfig" = CASE
        WHEN "settlementConfig"->'schedule' IS NOT NULL
        THEN "settlementConfig"->'schedule'
        ELSE '{"periodType":"weekly","dayOfWeek":1}'::jsonb
      END
    `);

    await queryRunner.query(`
      ALTER TABLE projects
      ALTER COLUMN "settlementConfig"
      SET DEFAULT '{"periodType":"weekly","dayOfWeek":1}'::jsonb
    `);
  }
}
