import { DataSource } from 'typeorm'
import { entities } from './entities'
import { Init1700000000000 } from './migrations/1700000000000-Init'
import { AddRecordsStatusIndex1700000001000 } from './migrations/1700000001000-AddRecordsStatusIndex'
import { AlertingAndAdmin1700000002000 } from './migrations/1700000002000-AlertingAndAdmin'
import { AnalyticsOpsAudit1700000003000 } from './migrations/1700000003000-AnalyticsOpsAudit'
import { HashApiKeys1700000004000 } from './migrations/1700000004000-HashApiKeys'

// 缓存在 globalThis 上，避免 Nitro dev 模式 HMR 重复创建连接池
const globalStore = globalThis as unknown as { __taskCalculateDs?: DataSource }

export function getDataSource(): DataSource {
  if (!globalStore.__taskCalculateDs) {
    globalStore.__taskCalculateDs = new DataSource({
      type: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root123',
      database: process.env.DB_NAME || 'task_calculate',
      entities,
      migrations: [
        Init1700000000000,
        AddRecordsStatusIndex1700000001000,
        AlertingAndAdmin1700000002000,
        AnalyticsOpsAudit1700000003000,
        HashApiKeys1700000004000,
      ],
      synchronize: false,
      logging: ['error'],
      charset: 'utf8mb4',
      // 与 MySQL 容器 TZ(Asia/Shanghai) 一致，datetime 存取统一按 +08:00
      timezone: '+08:00',
    })
  }
  return globalStore.__taskCalculateDs
}

export async function initDataSource(): Promise<DataSource> {
  const ds = getDataSource()
  if (!ds.isInitialized) {
    await ds.initialize()
  }
  return ds
}
