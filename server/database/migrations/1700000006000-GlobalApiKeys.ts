import type { MigrationInterface, QueryRunner } from 'typeorm'

// ApiKey 改为全局实体：system_id 仅保留为可空历史字段，不再代表归属关系。
// 实际授权范围完全由 system_ids / all_systems 决定；删除系统不再级联删除 Key。
export class GlobalApiKeys1700000006000 implements MigrationInterface {
  name = 'GlobalApiKeys1700000006000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `api_keys` DROP FOREIGN KEY `FK_api_keys_system`')
    await queryRunner.query('ALTER TABLE `api_keys` MODIFY COLUMN `system_id` int NULL')
    await queryRunner.query('ALTER TABLE `api_keys` ADD CONSTRAINT `FK_api_keys_system` FOREIGN KEY (`system_id`) REFERENCES `systems` (`id`) ON DELETE SET NULL')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `api_keys` DROP FOREIGN KEY `FK_api_keys_system`')
    await queryRunner.query(`
      UPDATE \`api_keys\` k
      SET k.\`system_id\` = COALESCE(
        CAST(JSON_UNQUOTE(JSON_EXTRACT(k.\`system_ids\`, '$[0]')) AS UNSIGNED),
        (SELECT MIN(s.\`id\`) FROM \`systems\` s)
      )
      WHERE k.\`system_id\` IS NULL
    `)
    await queryRunner.query('ALTER TABLE `api_keys` MODIFY COLUMN `system_id` int NOT NULL')
    await queryRunner.query('ALTER TABLE `api_keys` ADD CONSTRAINT `FK_api_keys_system` FOREIGN KEY (`system_id`) REFERENCES `systems` (`id`) ON DELETE CASCADE')
  }
}
