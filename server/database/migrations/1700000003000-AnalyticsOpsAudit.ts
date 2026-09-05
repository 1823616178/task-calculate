import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AnalyticsOpsAudit1700000003000 implements MigrationInterface {
  name = 'AnalyticsOpsAudit1700000003000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 系统级数据保留天数覆盖（null=跟随全局，0=永久）
    await queryRunner.query('ALTER TABLE `systems` ADD COLUMN `retention_days` int NULL')

    // 管理操作审计日志
    await queryRunner.query(`
      CREATE TABLE \`audit_logs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`user_id\` int NULL,
        \`username\` varchar(64) NOT NULL,
        \`action\` varchar(64) NOT NULL,
        \`target\` varchar(128) NOT NULL DEFAULT '',
        \`detail\` text NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_audit_logs_created\` (\`created_at\`),
        KEY \`IDX_audit_logs_action\` (\`action\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `audit_logs`')
    await queryRunner.query('ALTER TABLE `systems` DROP COLUMN `retention_days`')
  }
}
