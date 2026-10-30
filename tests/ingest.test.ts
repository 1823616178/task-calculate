import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiKeySchema, MetricRecordSchema, MetricSchema, SystemSchema } from '../server/database/entities'

// 内存版 DataSource：只实现 ingestData / resolveApiKey 用到的仓储方法
interface MetricRow {
  id: number
  systemId: number
  code: string
  name: string
  unit: string | null
  warnMin: number | null
  warnMax: number | null
  alarmMin: number | null
  alarmMax: number | null
  lastValue: number | null
  lastStatus: 'normal' | 'warning' | 'alarm' | 'none'
  lastReportedAt: Date | null
}

const db = vi.hoisted(() => ({
  systems: [] as Array<{ id: number, code: string }>,
  metrics: [] as MetricRow[],
  records: [] as Array<Record<string, unknown>>,
  apiKeyLookups: 0,
}))

vi.mock('../server/database/data-source', () => {
  function repo(schema: unknown) {
    if (schema === SystemSchema) {
      return { findOne: async ({ where }: { where: { code: string } }) => db.systems.find(s => s.code === where.code) ?? null }
    }
    if (schema === MetricSchema) {
      return {
        findOne: async ({ where }: { where: { id?: number, systemId?: number, code?: string } }) => {
          const row = where.id !== undefined
            ? db.metrics.find(m => m.id === where.id)
            : db.metrics.find(m => m.systemId === where.systemId && m.code === where.code)
          // 返回副本，模拟缓存对象与 DB 行相互独立
          return row ? { ...row } : null
        },
        update: async (id: number, patch: Partial<MetricRow>) => {
          Object.assign(db.metrics.find(m => m.id === id)!, patch)
        },
      }
    }
    if (schema === MetricRecordSchema) {
      return {
        create: (v: Record<string, unknown>) => v,
        save: async (v: Record<string, unknown> | Array<Record<string, unknown>>) => {
          if (Array.isArray(v)) {
            const saved = v.map((item) => {
              const row = { ...item, id: db.records.length + 1 }
              db.records.push(row)
              return row
            })
            return saved
          }
          const saved = { ...v, id: db.records.length + 1 }
          db.records.push(saved)
          return saved
        },
      }
    }
    if (schema === ApiKeySchema) {
      return {
        findOne: async () => {
          db.apiKeyLookups += 1
          return null
        },
      }
    }
    throw new Error('unexpected schema')
  }
  const ds = {
    getRepository: repo,
    transaction: async (fn: (em: { getRepository: typeof repo }) => Promise<unknown>) => fn({ getRepository: repo }),
  }
  return { initDataSource: async () => ds, getDataSource: () => ds }
})

const broadcast = vi.hoisted(() => vi.fn())
const dispatch = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('../server/services/broadcastService', () => ({ broadcastMetricUpdate: broadcast }))
vi.mock('../server/services/alertingService', () => ({ dispatchAlertNotifications: dispatch }))

const { clearMetricCache, ingestBatchData, ingestData, IngestError } = await import('../server/services/ingestService')
const { clearApiKeyCache, resolveApiKey } = await import('../server/utils/apiKey')

beforeEach(() => {
  db.systems = [{ id: 1, code: 'line1' }, { id: 2, code: 'line2' }]
  db.metrics = [{
    id: 10,
    systemId: 1,
    code: 'temp',
    name: '温度',
    unit: '℃',
    warnMin: 10,
    warnMax: 70,
    alarmMin: 0,
    alarmMax: 90,
    lastValue: null,
    lastStatus: 'none',
    lastReportedAt: null,
  }]
  db.records = []
  db.apiKeyLookups = 0
  clearMetricCache()
  clearApiKeyCache()
  broadcast.mockClear()
  dispatch.mockClear()
})

describe('ingestData', () => {
  it('入库、更新 last_* 并在状态跃迁时触发告警', async () => {
    const result = await ingestData({ systemCode: 'line1', metricCode: 'temp', value: 95 }, 'http', { expectedSystemId: 1 })
    expect(result.status).toBe('alarm')
    expect(db.records).toHaveLength(1)
    expect(db.metrics[0]!.lastStatus).toBe('alarm')
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('状态不变时不重复触发告警', async () => {
    await ingestData({ systemCode: 'line1', metricCode: 'temp', value: 95 }, 'http', { expectedSystemId: 1 })
    await ingestData({ systemCode: 'line1', metricCode: 'temp', value: 96 }, 'http', { expectedSystemId: 1 })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('乱序旧报文照常入库，但不覆盖 last_*、不广播、不告警', async () => {
    await ingestData({ systemCode: 'line1', metricCode: 'temp', value: 50, timestamp: '2026-09-01T10:00:00Z' }, 'http', { expectedSystemId: 1 })
    broadcast.mockClear()
    dispatch.mockClear()

    await ingestData({ systemCode: 'line1', metricCode: 'temp', value: 95, timestamp: '2026-09-01T09:00:00Z' }, 'http', { expectedSystemId: 1 })
    expect(db.records).toHaveLength(2)
    expect(db.metrics[0]!.lastValue).toBe(50)
    expect(db.metrics[0]!.lastStatus).toBe('normal')
    expect(broadcast).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('并发上报按指标串行化，跃迁判定基于前一条的真实状态', async () => {
    await Promise.all([
      ingestData({ systemCode: 'line1', metricCode: 'temp', value: 95, timestamp: '2026-09-01T10:00:00Z' }, 'http', { expectedSystemId: 1 }),
      ingestData({ systemCode: 'line1', metricCode: 'temp', value: 96, timestamp: '2026-09-01T10:00:01Z' }, 'http', { expectedSystemId: 1 }),
    ])
    // none→alarm 一次，alarm→alarm 不再触发
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(db.metrics[0]!.lastValue).toBe(96)
  })

  it('越权写入其他系统返回 403', async () => {
    await expect(ingestData({ systemCode: 'line1', metricCode: 'temp', value: 1 }, 'http', { expectedSystemId: 2 }))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('未知系统与越权同样返回 403，不泄露系统是否存在', async () => {
    const err = await ingestData({ systemCode: 'nope', metricCode: 'temp', value: 1 }, 'http', { expectedSystemId: 1 }).catch(e => e)
    expect(err).toBeInstanceOf(IngestError)
    expect(err.statusCode).toBe(403)
  })

  it('数值保留两位小数后入库、判定与广播', async () => {
    await ingestData({ systemCode: 'line1', metricCode: 'temp', value: 100 - 42.1 }, 'mqtt', { expectedSystemId: 1 })
    await ingestData({ systemCode: 'line1', metricCode: 'temp', value: '33.335' }, 'mqtt', { expectedSystemId: 1 })
    expect(db.records.map(r => r.value)).toEqual([57.9, 33.34])
    expect(db.metrics[0]!.lastValue).toBe(33.34)
    expect(broadcast.mock.calls.at(-1)![0].data.value).toBe(33.34)
  })

  it('非法报文返回 400', async () => {
    await expect(ingestData({ systemCode: 'line1', metricCode: 'temp', value: 'abc' }, 'http', { expectedSystemId: 1 }))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('resolveApiKey 负缓存', () => {
  it('无效 key 短期内不重复查库，清缓存后重新查询', async () => {
    expect(await resolveApiKey('dk_bad')).toBeNull()
    expect(await resolveApiKey('dk_bad')).toBeNull()
    expect(db.apiKeyLookups).toBe(1)

    clearApiKeyCache()
    expect(await resolveApiKey('dk_bad')).toBeNull()
    expect(db.apiKeyLookups).toBe(2)
  })
})

describe('ingestBatchData', () => {
  it('同一指标一批准入多条，last_* 只取最新一条，广播与告警各一次', async () => {
    const result = await ingestBatchData([
      { systemCode: 'line1', metricCode: 'temp', value: 50, timestamp: '2026-09-01T10:00:00Z' },
      { systemCode: 'line1', metricCode: 'temp', value: 95, timestamp: '2026-09-01T10:01:00Z' },
    ], 'http', { expectedSystemId: 1 })
    expect(result.count).toBe(2)
    expect(db.records).toHaveLength(2)
    expect(db.metrics[0]!.lastValue).toBe(95)
    expect(db.metrics[0]!.lastStatus).toBe('alarm')
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledTimes(1)
    // 结果与输入顺序对应
    expect(result.results.map(r => r.status)).toEqual(['normal', 'alarm'])
  })

  it('任一非法即整批拒绝，不写任何记录', async () => {
    await expect(ingestBatchData([
      { systemCode: 'line1', metricCode: 'temp', value: 50 },
      { systemCode: 'line1', metricCode: 'temp', value: 'abc' },
    ], 'http', { expectedSystemId: 1 })).rejects.toMatchObject({ statusCode: 400 })
    expect(db.records).toHaveLength(0)
  })

  it('空数组与超限数组均拒绝', async () => {
    await expect(ingestBatchData([], 'http', { expectedSystemId: 1 })).rejects.toMatchObject({ statusCode: 400 })
    const many = Array.from({ length: 101 }, () => ({ systemCode: 'line1', metricCode: 'temp', value: 1 }))
    await expect(ingestBatchData(many, 'http', { expectedSystemId: 1 })).rejects.toMatchObject({ statusCode: 400 })
  })
})
