import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AlertingAndAdmin1700000002000 implements MigrationInterface {
  name = 'AlertingAndAdmin1700000002000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 通知渠道：webhook / 钉钉 / 企微 / 邮件
    await queryRunner.query(`
      CREATE TABLE \`alert_channels\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`type\` varchar(16) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`target\` varchar(512) NOT NULL,
        \`secret\` varchar(512) NULL,
        \`enabled\` tinyint(1) NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // 告警规则：指标 × 渠道，通知状态（预警/告警）+ 规则级冷却
    await queryRunner.query(`
      CREATE TABLE \`alert_rules\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`metric_id\` int NOT NULL,
        \`channel_id\` int NOT NULL,
        \`notify_warning\` tinyint(1) NOT NULL DEFAULT 1,
        \`notify_alarm\` tinyint(1) NOT NULL DEFAULT 1,
        \`cooldown_seconds\` int NOT NULL DEFAULT 300,
        \`enabled\` tinyint(1) NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_alert_rules_metric_channel\` (\`metric_id\`, \`channel_id\`),
        KEY \`IDX_alert_rules_metric\` (\`metric_id\`),
        CONSTRAINT \`FK_alert_rules_metric\` FOREIGN KEY (\`metric_id\`) REFERENCES \`metrics\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_alert_rules_channel\` FOREIGN KEY (\`channel_id\`) REFERENCES \`alert_channels\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // 静默窗口：metric_id 非空=指标级；仅 system_id 非空=系统级；两者皆空=全局
    await queryRunner.query(`
      CREATE TABLE \`silence_rules\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`system_id\` int NULL,
        \`metric_id\` int NULL,
        \`start_at\` datetime NOT NULL,
        \`end_at\` datetime NOT NULL,
        \`reason\` varchar(255) NOT NULL DEFAULT '',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_silence_rules_time\` (\`start_at\`, \`end_at\`),
        CONSTRAINT \`FK_silence_rules_system\` FOREIGN KEY (\`system_id\`) REFERENCES \`systems\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_silence_rules_metric\` FOREIGN KEY (\`metric_id\`) REFERENCES \`metrics\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query('ALTER TABLE `api_keys` ADD COLUMN `last_used_at` datetime NULL')
    await queryRunner.query('ALTER TABLE `users` ADD COLUMN `enabled` tinyint(1) NOT NULL DEFAULT 1')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `users` DROP COLUMN `enabled`')
    await queryRunner.query('ALTER TABLE `api_keys` DROP COLUMN `last_used_at`')
    await queryRunner.query('DROP TABLE IF EXISTS `silence_rules`')
    await queryRunner.query('DROP TABLE IF EXISTS `alert_rules`')
    await queryRunner.query('DROP TABLE IF EXISTS `alert_channels`')
  }
}
