import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 将所有使用旧默认配置（maxSteps=9）的项目更新为正确值（maxSteps=4）。
 * 旧配置：cyclesPerStep=3, maxSteps=9 → 需要 27 次结算才清零（错误）
 * 新配置：cyclesPerStep=3, maxSteps=4 → 12 次结算后清零（正确）
 *
 * 仅更新 maxSteps=9 且 cyclesPerStep=3 的记录（即旧默认值），
 * 不影响手动配置了其他值的项目。
 */
export class FixAnnealingMaxSteps1700000000014 implements MigrationInterface {
  name = 'FixAnnealingMaxSteps1700000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE projects
      SET "annealingConfig" = jsonb_set("annealingConfig", '{maxSteps}', '4')
      WHERE ("annealingConfig"->>'maxSteps')::int = 9
        AND ("annealingConfig"->>'cyclesPerStep')::int = 3
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE projects
      SET "annealingConfig" = jsonb_set("annealingConfig", '{maxSteps}', '9')
      WHERE ("annealingConfig"->>'maxSteps')::int = 4
        AND ("annealingConfig"->>'cyclesPerStep')::int = 3
    `);
  }
}
