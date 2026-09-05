import type { MigrationInterface, QueryRunner } from 'typeorm'

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`systems\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`code\` varchar(64) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`description\` varchar(512) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_systems_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query(`
      CREATE TABLE \`metrics\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`system_id\` int NOT NULL,
        \`code\` varchar(64) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`unit\` varchar(32) NULL,
        \`warn_min\` double NULL,
        \`warn_max\` double NULL,
        \`alarm_min\` double NULL,
        \`alarm_max\` double NULL,
        \`last_value\` double NULL,
        \`last_status\` varchar(16) NOT NULL DEFAULT 'none',
        \`last_reported_at\` datetime NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_metrics_system_code\` (\`system_id\`, \`code\`),
        KEY \`IDX_metrics_system\` (\`system_id\`),
        CONSTRAINT \`FK_metrics_system\` FOREIGN KEY (\`system_id\`) REFERENCES \`systems\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query(`
      CREATE TABLE \`metric_records\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`metric_id\` int NOT NULL,
        \`value\` double NOT NULL,
        \`status\` varchar(16) NOT NULL,
        \`channel\` varchar(8) NOT NULL,
        \`payload\` text NULL,
        \`reported_at\` datetime NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_records_metric_reported\` (\`metric_id\`, \`reported_at\`),
        CONSTRAINT \`FK_records_metric\` FOREIGN KEY (\`metric_id\`) REFERENCES \`metrics\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`username\` varchar(64) NOT NULL,
        \`password_hash\` varchar(128) NOT NULL,
        \`role\` varchar(16) NOT NULL DEFAULT 'viewer',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_users_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query(`
      CREATE TABLE \`api_keys\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`system_id\` int NOT NULL,
        \`key\` varchar(64) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`enabled\` tinyint(1) NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_api_keys_key\` (\`key\`),
        CONSTRAINT \`FK_api_keys_system\` FOREIGN KEY (\`system_id\`) REFERENCES \`systems\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `api_keys`')
    await queryRunner.query('DROP TABLE IF EXISTS `metric_records`')
    await queryRunner.query('DROP TABLE IF EXISTS `metrics`')
    await queryRunner.query('DROP TABLE IF EXISTS `users`')
    await queryRunner.query('DROP TABLE IF EXISTS `systems`')
  }
}
