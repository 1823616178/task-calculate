import { getDataSource, initDataSource } from '../database/data-source'

// 启动时初始化数据库连接并执行迁移；失败则中止启动（稳定优先，不带病运行）
export default defineNitroPlugin(async (nitroApp) => {
  try {
    const ds = await initDataSource()
    const applied = await ds.runMigrations()
    console.log(
      `[typeorm] connected to ${ds.options.database as string}, ` +
        (applied.length ? `applied migrations: ${applied.map((m) => m.name).join(', ')}` : 'no pending migrations'),
    )
  }
  catch (err) {
    console.error('[typeorm] failed to connect or migrate, aborting startup:', err)
    throw err
  }

  // 优雅停机：释放连接池
  nitroApp.hooks.hook('close', () => {
    getDataSource()
      .destroy()
      .then(() => console.log('[typeorm] connection pool closed'))
      .catch(() => undefined)
  })
})
