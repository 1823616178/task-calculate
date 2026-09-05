import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRecordsStatusIndex1700000001000 implements MigrationInterface {
  name = 'AddRecordsStatusIndex1700000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 按状态筛选历史记录（如 ?status=alarm）不再全表扫描
    await queryRunner.query('CREATE INDEX `IDX_records_status_reported` ON `metric_records` (`status`, `reported_at`)')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `IDX_records_status_reported` ON `metric_records`')
  }
}
