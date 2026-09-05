import type { MigrationInterface, QueryRunner } from 'typeorm'

// ApiKey 摘要化：库内 key 由明文改为 SHA-256 摘要；
// 原明文前 8 位保存到 key_prefix 供列表展示。
export class HashApiKeys1700000004000 implements MigrationInterface {
  name = 'HashApiKeys1700000004000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `api_keys` ADD COLUMN `key_prefix` varchar(16) NULL')
    // 先保存展示前缀，再将明文替换为 SHA-256 摘要（sha256 hex 为 64 字符，列宽不变）
    await queryRunner.query('UPDATE `api_keys` SET `key_prefix` = LEFT(`key`, 8)')
    await queryRunner.query('UPDATE `api_keys` SET `key` = SHA2(`key`, 256)')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 摘要不可逆，down 仅移除前缀列
    await queryRunner.query('ALTER TABLE `api_keys` DROP COLUMN `key_prefix`')
  }
}
