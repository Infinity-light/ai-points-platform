import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResignedRole1700000000031 implements MigrationInterface {
  name = 'AddResignedRole1700000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert resigned system role
    await queryRunner.query(`
      INSERT INTO "roles" ("id", "tenantId", "name", "description", "scope", "isSystem")
      VALUES ('00000000-0000-0000-0000-000000000007', NULL, 'resigned', '已离职，仅保留只读权限', 'tenant', true)
      ON CONFLICT ("id") DO NOTHING
    `);

    // Grant read-only permissions for all resources
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "resource", "action") VALUES
        ('00000000-0000-0000-0000-000000000007', 'users', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'roles', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'projects', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'tasks', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'points', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'votes', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'settlements', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'dividends', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'bulletin', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'auctions', 'read'),
        ('00000000-0000-0000-0000-000000000007', 'audit', 'read')
      ON CONFLICT ("roleId", "resource", "action") DO NOTHING
    `);

    // Also add config:manage to super_admin (used by AI config and Feishu config controllers)
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "resource", "action")
      VALUES ('00000000-0000-0000-0000-000000000001', 'config', 'manage')
      ON CONFLICT ("roleId", "resource", "action") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "role_permissions" WHERE "roleId" = '00000000-0000-0000-0000-000000000007'`);
    await queryRunner.query(`DELETE FROM "roles" WHERE "id" = '00000000-0000-0000-0000-000000000007'`);
    await queryRunner.query(`DELETE FROM "role_permissions" WHERE "roleId" = '00000000-0000-0000-0000-000000000001' AND "resource" = 'config' AND "action" = 'manage'`);
  }
}
