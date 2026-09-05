import bcrypt from 'bcryptjs'
import { initDataSource } from '../server/database/data-source'
import { ApiKeySchema, MetricSchema, SystemSchema, UserSchema } from '../server/database/entities'
import { DEMO_API_KEY } from './const'

try {
  process.loadEnvFile()
}
catch {
  // .env 不存在时使用 data-source 内置默认值
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
    await userRepo.save(
      userRepo.create({ username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10), role: 'admin' }),
    )
    console.log('created user: admin / admin123')
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
  const existsKey = await keyRepo.findOne({ where: { key: DEMO_API_KEY } })
  if (!existsKey) {
    await keyRepo.save(keyRepo.create({ systemId: line1.id, key: DEMO_API_KEY, name: '一号产线演示 Key', enabled: true }))
    console.log(`created api key: ${DEMO_API_KEY}`)
  }

  console.log('seed done')
  await ds.destroy()
}

main().catch((err) => {
  console.error('seed failed:', err)
  process.exit(1)
})
