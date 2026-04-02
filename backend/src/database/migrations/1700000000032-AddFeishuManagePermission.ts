import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeishuManagePermission1700000000032
  implements MigrationInterface
{
  name = 'AddFeishuManagePermission1700000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "resource", "action")
      VALUES ('00000000-0000-0000-0000-000000000001', 'feishu', 'manage')
      ON CONFLICT ("roleId", "resource", "action") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "roleId" = '00000000-0000-0000-0000-000000000001'
        AND "resource" = 'feishu'
        AND "action" = 'manage'
    `);
  }
}
