import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { initDataSource } from '../server/database/data-source'
import { ApiKeySchema, MetricSchema, SystemSchema, UserSchema } from '../server/database/entities'
import { generateApiKey, hashApiKey } from '../server/utils/apiKeyGen'
import { DEMO_API_KEY } from './const'

try {
  process.loadEnvFile()
}
catch {
  // .env 不存在时使用 data-source 内置默认值
}

// Seed 写入固定演示账号/ApiKey，仅允许开发模式；生产环境需显式 SEED_ALLOW=1，
// 且改用随机密码与随机 ApiKey（仅打印一次）
const isProd = process.env.NODE_ENV === 'production'
if (isProd && process.env.SEED_ALLOW !== '1') {
  console.error('refusing to seed in production without SEED_ALLOW=1')
  process.exit(1)
}

async function main() {
  const ds = await initDataSource()
  const applied = await ds.runMigrations()
  if (applied.length) {
    console.log('migrations applied:', applied.map((m) => m.name).join(', '))
  }

  const userRepo = ds.getRepository(UserSchema)
  const admin = await userRepo.findOne({ where: { username: 'admin' } })
  if (!admin) {
    const password = isProd ? randomBytes(9).toString('base64url') : 'admin123'
    await userRepo.save(
      userRepo.create({ username: 'admin', passwordHash: bcrypt.hashSync(password, 10), role: 'admin' }),
    )
    console.log(`created user: admin / ${password}${isProd ? '（请立即修改）' : ''}`)
  }
  else {
    console.log('user admin already exists, skipped')
  }

  const systemRepo = ds.getRepository(SystemSchema)
  let line1 = await systemRepo.findOne({ where: { code: 'line1' } })
  if (!line1) {
    line1 = await systemRepo.save(
      systemRepo.create({ code: 'line1', name: '一号产线', description: '演示系统：一号产线设备监控' }),
    )
    console.log('created system: line1')
  }

  const metricRepo = ds.getRepository(MetricSchema)
  const demoMetrics = [
    { code: 'temp', name: '温度', unit: '℃', warnMin: 10, warnMax: 70, alarmMin: 0, alarmMax: 90 },
    { code: 'humidity', name: '湿度', unit: '%RH', warnMin: 30, warnMax: 70, alarmMin: 10, alarmMax: 90 },
    { code: 'pressure', name: '压力', unit: 'kPa', warnMin: 80, warnMax: 120, alarmMin: 50, alarmMax: 150 },
  ]
  for (const m of demoMetrics) {
    const exists = await metricRepo.findOne({ where: { systemId: line1.id, code: m.code } })
    if (!exists) {
      await metricRepo.save(metricRepo.create({ ...m, systemId: line1.id }))
      console.log(`created metric: line1/${m.code}`)
    }
  }

  const keyRepo = ds.getRepository(ApiKeySchema)
  const demoKeyName = '一号产线演示 Key'
  // 生产环境每次生成随机 key，无法按摘要查重，改按名称判断是否已创建
  const existsKey = isProd
    ? await keyRepo.findOne({ where: { name: demoKeyName } })
    : await keyRepo.findOne({ where: { key: hashApiKey(DEMO_API_KEY) } })
  if (!existsKey) {
    const demoKey = isProd ? generateApiKey() : DEMO_API_KEY
    await keyRepo.save(keyRepo.create({
      legacySystemId: null,
      systemIds: [line1.id],
      allSystems: false,
      permissions: ['data:read', 'data:write'],
      key: hashApiKey(demoKey),
      keyPrefix: demoKey.slice(0, 8),
      name: demoKeyName,
      enabled: true,
    }))
    console.log(`created api key: ${demoKey}${isProd ? '（仅本次打印）' : ''}`)
  }

  console.log('seed done')
  await ds.destroy()
}

main().catch((err) => {
  console.error('seed failed:', err)
  process.exit(1)
})
