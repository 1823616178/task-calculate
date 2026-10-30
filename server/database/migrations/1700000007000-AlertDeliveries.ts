import type { MigrationInterface, QueryRunner } from 'typeorm'

// 告警发送记录表：规则触发后每次发送（成功/失败）各记一行。
export class AlertDeliveries1700000007000 implements MigrationInterface {
  name = 'AlertDeliveries1700000007000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`alert_deliveries\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`rule_id\` int NOT NULL,
        \`channel_id\` int NOT NULL,
        \`metric_id\` int NOT NULL,
        \`prev_status\` varchar(16) NOT NULL,
        \`new_status\` varchar(16) NOT NULL,
        \`value\` double NOT NULL,
        \`status\` varchar(16) NOT NULL,
        \`error\` varchar(512) NULL,
        \`reported_at\` datetime NOT NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_alert_deliveries_rule_created\` (\`rule_id\`, \`created_at\`),
        INDEX \`IDX_alert_deliveries_metric_created\` (\`metric_id\`, \`created_at\`)
      ) ENGINE=InnoDB
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `alert_deliveries`')
  }
}
