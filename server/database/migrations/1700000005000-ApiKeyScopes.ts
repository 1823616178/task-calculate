import type { MigrationInterface, QueryRunner } from 'typeorm'

// ApiKey 从“固定绑定一个系统”升级为“权限白名单 + 多系统范围”。
// 旧 Key 自动保留原行为：可读、可上报，且只能访问原 system_id。
export class ApiKeyScopes1700000005000 implements MigrationInterface {
  name = 'ApiKeyScopes1700000005000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `api_keys` ADD COLUMN `system_ids` text NULL')
    await queryRunner.query('ALTER TABLE `api_keys` ADD COLUMN `all_systems` tinyint(1) NOT NULL DEFAULT 0')
    await queryRunner.query('ALTER TABLE `api_keys` ADD COLUMN `permissions` text NULL')
    await queryRunner.query("UPDATE `api_keys` SET `system_ids` = CONCAT('[', `system_id`, ']'), `permissions` = '[\"data:read\",\"data:write\"]'")
    await queryRunner.query('ALTER TABLE `api_keys` MODIFY COLUMN `system_ids` text NOT NULL')
    await queryRunner.query('ALTER TABLE `api_keys` MODIFY COLUMN `permissions` text NOT NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `api_keys` DROP COLUMN `permissions`')
    await queryRunner.query('ALTER TABLE `api_keys` DROP COLUMN `all_systems`')
    await queryRunner.query('ALTER TABLE `api_keys` DROP COLUMN `system_ids`')
  }
}
