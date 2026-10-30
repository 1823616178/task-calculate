import { initDataSource } from '../database/data-source'
import { MetricSchema, MetricRecordSchema, SystemSchema } from '../database/entities'
import type { MetricEntity } from '../database/entities'
import type { IngestChannel, MetricStatus, MetricUpdateEvent } from '../../shared/types'
import { firstZodMessage, ingestSchema } from '../utils/validation'
import { stringifyPayload } from '../utils/payload'
import { withLock } from '../utils/locks'
import { evaluateStatus } from './statusService'
import { broadcastMetricUpdate } from './broadcastService'
import { dispatchAlertNotifications } from './alertingService'

export class IngestError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'IngestError'
    this.statusCode = statusCode
  }
}

export interface IngestResult {
  recordId: number
  status: MetricStatus
}

export interface IngestOptions {
  // expectedSystemId 保留给旧调用方；新授权模型使用 allowedSystemIds。
  expectedSystemId?: number
  // undefined=全部系统；数组=只允许这些系统。
  allowedSystemIds?: number[]
}

interface SystemCacheEntry {
  systemId: number | null
  expiresAt: number
}

interface MetricCacheEntry {
  metric: MetricEntity | null
  expiresAt: number
}

// (systemCode, metricCode) -> Metric 缓存；阈值等信息经管理接口修改时整体清空
const metricCache = new Map<string, MetricCacheEntry>()
const systemCache = new Map<string, SystemCacheEntry>()
// 负结果（未知 code）短 TTL 缓存，防止坏消息/恶意报文洪峰直查 DB；正结果长期有效，管理接口变更时清空
const NEGATIVE_TTL_MS = 30_000

export function clearMetricCache(): void {
  metricCache.clear()
  systemCache.clear()
}

export async function resolveSystemId(systemCode: string): Promise<number | null> {
  const now = Date.now()
  const cached = systemCache.get(systemCode)
  if (cached && (cached.systemId !== null || cached.expiresAt > now)) {
    return cached.systemId
  }

  const ds = await initDataSource()
  const system = await ds.getRepository(SystemSchema).findOne({ where: { code: systemCode } })
  const entry: SystemCacheEntry = system
    ? { systemId: system.id, expiresAt: Number.POSITIVE_INFINITY }
    : { systemId: null, expiresAt: now + NEGATIVE_TTL_MS }
  systemCache.set(systemCode, entry)
  return entry.systemId
}

async function resolveMetric(systemCode: string, metricCode: string): Promise<MetricEntity> {
  const cacheKey = `${systemCode}:${metricCode}`
  const now = Date.now()
  const cached = metricCache.get(cacheKey)
  if (cached) {
    if (cached.metric !== null) return cached.metric
    if (cached.expiresAt > now) {
      throw new IngestError(`unknown metricCode: ${metricCode} (system: ${systemCode})`, 404)
    }
  }

  const systemId = await resolveSystemId(systemCode)
  if (systemId === null) {
    throw new IngestError(`unknown systemCode: ${systemCode}`, 404)
  }
  const ds = await initDataSource()
  const metric = await ds
    .getRepository(MetricSchema)
    .findOne({ where: { systemId, code: metricCode } })
  if (!metric) {
    metricCache.set(cacheKey, { metric: null, expiresAt: now + NEGATIVE_TTL_MS })
    throw new IngestError(`unknown metricCode: ${metricCode} (system: ${systemCode})`, 404)
  }

  metricCache.set(cacheKey, { metric, expiresAt: Number.POSITIVE_INFINITY })
  return metric
}

/**
 * 统一接收管道：校验 → 系统范围校验 → 解析指标 → 阈值判定 → 入库（事务）→ 广播。
 * 三个接收通道（HTTP / MQTT / WS）都调用此函数。
 */
export async function ingestData(raw: unknown, channel: IngestChannel, options: IngestOptions = {}): Promise<IngestResult> {
  const parsed = ingestSchema.safeParse(raw)
  if (!parsed.success) {
    throw new IngestError(`invalid payload: ${firstZodMessage(parsed.error)}`)
  }
  const { systemCode, metricCode, value, timestamp } = parsed.data

  let reportedAt = new Date()
  if (timestamp) {
    const parsedTime = new Date(timestamp)
    if (Number.isNaN(parsedTime.getTime())) {
      throw new IngestError(`invalid timestamp: ${timestamp}`)
    }
    reportedAt = parsedTime
  }

  // ApiKey 系统范围校验；未知系统与越权统一 403，避免枚举系统编码。
  if (options.expectedSystemId !== undefined || options.allowedSystemIds !== undefined) {
    const systemId = await resolveSystemId(systemCode)
    const allowed = options.expectedSystemId !== undefined
      ? systemId === options.expectedSystemId
      : systemId !== null && options.allowedSystemIds!.includes(systemId)
    if (!allowed) {
      throw new IngestError('api key not allowed for this system', 403)
    }
  }

  const metric = await resolveMetric(systemCode, metricCode)
  const status = evaluateStatus(value, metric)

  const ds = await initDataSource()
  const payload = stringifyPayload(raw)

  // 按指标维度串行化：并发/乱序上报时，事务内读取最新的 last_* 作为跃迁判定基准，
  // 且 last_* 仅在 reportedAt 不早于已存值时更新，避免旧报文覆盖最新状态。
  const { prevStatus, isLatest, recordId } = await withLock(`metric:${metric.id}`, async () => {
    return ds.transaction(async (em) => {
      // 事务内锁定指标行并读取真实最新状态（不依赖缓存快照）
      const metricRepo = em.getRepository(MetricSchema)
      const current = await metricRepo.findOne({
        where: { id: metric.id },
        lock: { mode: 'pessimistic_write' },
      })
      const dbLastReportedAt = current?.lastReportedAt ?? null
      const isLatest = dbLastReportedAt === null || reportedAt.getTime() >= dbLastReportedAt.getTime()
      const prevStatus: MetricStatus = current?.lastStatus ?? metric.lastStatus

      const recordRepo = em.getRepository(MetricRecordSchema)
      const saved = await recordRepo.save(
        recordRepo.create({
          metricId: metric.id,
          value,
          status,
          channel,
          payload,
          reportedAt,
        }),
      )
      if (isLatest) {
        await metricRepo.update(metric.id, {
          lastValue: value,
          lastStatus: status,
          lastReportedAt: reportedAt,
        })
      }
      return { prevStatus, isLatest, recordId: Number(saved.id) }
    })
  })

  // 同步缓存中的 last_*（阈值字段不变，缓存仍有效）；过期报文不回写
  if (isLatest) {
    metric.lastValue = value
    metric.lastStatus = status
    metric.lastReportedAt = reportedAt
  }

  // 过期报文不广播、不触发告警，避免看板回滚与告警乱序/重复
  if (!isLatest) {
    return { recordId, status }
  }

  const event: MetricUpdateEvent = {
    type: 'metric.update',
    data: {
      systemId: metric.systemId,
      systemCode,
      metricId: metric.id,
      metricCode: metric.code,
      metricName: metric.name,
      unit: metric.unit,
      value,
      status,
      reportedAt: reportedAt.toISOString(),
    },
  }
  broadcastMetricUpdate(event)

  // 状态跃迁进入 warning/alarm 时异步分发告警通知（静默/规则/冷却在分发内部处理，不阻塞接收管道）
  if (prevStatus !== status) {
    void dispatchAlertNotifications({
      metric,
      systemCode,
      prevStatus,
      newStatus: status,
      value,
      reportedAt,
    })
  }

  return { recordId, status }
}
