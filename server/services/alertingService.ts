import { createHmac } from 'node:crypto'
import { Brackets } from 'typeorm'
import type { MetricStatus } from '../../shared/types'
import { initDataSource } from '../database/data-source'
import type { AlertChannelEntity, AlertRuleEntity, MetricEntity, SilenceRuleEntity } from '../database/entities'
import { AlertDeliverySchema, AlertRuleSchema, SilenceRuleSchema, SystemSchema } from '../database/entities'

// ---- 纯函数（可单测） ----

/** 状态跃迁是否应触发通知：进入 warning/alarm 即触发（none/normal 恢复不通知） */
export function shouldNotify(prev: MetricStatus, next: MetricStatus): boolean {
  if (next !== 'warning' && next !== 'alarm') return false
  return prev !== next
}

export interface AlertEventInfo {
  systemCode: string
  systemName: string
  metricCode: string
  metricName: string
  unit: string | null
  value: number
  status: MetricStatus
  prevStatus: MetricStatus
  warnMin: number | null
  warnMax: number | null
  alarmMin: number | null
  alarmMax: number | null
  reportedAt: Date
}

function rangeText(min: number | null, max: number | null): string {
  if (min === null && max === null) return '未配置'
  return `${min ?? '-∞'} ~ ${max ?? '+∞'}`
}

const STATUS_LABEL: Record<MetricStatus, string> = {
  normal: '正常',
  warning: '预警',
  alarm: '告警',
  none: '未判定',
}

export function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function buildAlertTitle(info: AlertEventInfo): string {
  const unit = info.unit ?? ''
  return `【${STATUS_LABEL[info.status]}】${info.systemName}/${info.metricName} = ${info.value}${unit}`
}

/** 通知正文（markdown，钉钉/企微用；webhook/邮件取纯文本行） */
export function buildAlertText(info: AlertEventInfo): string[] {
  const lines = [
    buildAlertTitle(info),
    `- 系统：${info.systemName}（${info.systemCode}）`,
    `- 指标：${info.metricName}（${info.metricCode}）`,
    `- 当前值：${info.value}${info.unit ?? ''}，状态 ${STATUS_LABEL[info.status]}（原 ${STATUS_LABEL[info.prevStatus]}）`,
    `- 预警区间：${rangeText(info.warnMin, info.warnMax)}，告警区间：${rangeText(info.alarmMin, info.alarmMax)}`,
    `- 发生时间：${formatDateTime(info.reportedAt)}`,
  ]
  const appUrl = process.env.APP_URL
  if (appUrl) lines.push(`- 看板链接：${appUrl.replace(/\/$/, '')}/systems`)
  return lines
}

/** 钉钉机器人加签：sign = base64(HmacSHA256(`${timestamp}\n${secret}`)) */
export function signDingtalk(secret: string, timestamp: number): string {
  const hmac = createHmac('sha256', secret).update(`${timestamp}\n${secret}`).digest('base64')
  return encodeURIComponent(hmac)
}

/** 规则是否匹配当前告警状态 */
export function ruleMatchesStatus(rule: Pick<AlertRuleEntity, 'notifyWarning' | 'notifyAlarm'>, status: MetricStatus): boolean {
  if (status === 'warning') return rule.notifyWarning
  if (status === 'alarm') return rule.notifyAlarm
  return false
}

// ---- 发送器 ----

const SEND_TIMEOUT_MS = 10_000

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) })
}

async function sendWebhook(channel: AlertChannelEntity, info: AlertEventInfo): Promise<void> {
  const res = await fetchWithTimeout(channel.target, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'metric.alert',
      data: {
        systemCode: info.systemCode,
        systemName: info.systemName,
        metricCode: info.metricCode,
        metricName: info.metricName,
        value: info.value,
        unit: info.unit,
        status: info.status,
        prevStatus: info.prevStatus,
        reportedAt: info.reportedAt.toISOString(),
        text: buildAlertText(info).join('\n'),
      },
    }),
  })
  if (!res.ok) throw new Error(`webhook responded ${res.status}`)
}

async function sendDingtalk(channel: AlertChannelEntity, info: AlertEventInfo): Promise<void> {
  let url = channel.target
  if (channel.secret) {
    const ts = Date.now()
    url += `${url.includes('?') ? '&' : '?'}timestamp=${ts}&sign=${signDingtalk(channel.secret, ts)}`
  }
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: { title: buildAlertTitle(info), text: buildAlertText(info).join('\n\n') },
    }),
  })
  const body = (await res.json().catch(() => null)) as { errcode?: number, errmsg?: string } | null
  if (!res.ok || (body && body.errcode !== 0)) {
    throw new Error(`dingtalk responded ${res.status} ${body?.errmsg ?? ''}`)
  }
}

async function sendWecom(channel: AlertChannelEntity, info: AlertEventInfo): Promise<void> {
  const res = await fetchWithTimeout(channel.target, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: { content: buildAlertText(info).join('\n') },
    }),
  })
  const body = (await res.json().catch(() => null)) as { errcode?: number, errmsg?: string } | null
  if (!res.ok || (body && body.errcode !== 0)) {
    throw new Error(`wecom responded ${res.status} ${body?.errmsg ?? ''}`)
  }
}

let mailTransporterPromise: Promise<unknown> | null = null

async function getMailTransporter(): Promise<{ sendMail: (opts: unknown) => Promise<unknown> }> {
  // SMTP 服务器为全局配置（环境变量），渠道 target 为收件人列表
  if (!mailTransporterPromise) {
    mailTransporterPromise = import('nodemailer').then((nodemailer) => {
      const host = process.env.SMTP_HOST || ''
      const port = Number(process.env.SMTP_PORT || 587)
      if (!host) throw new Error('SMTP_HOST 未配置，无法发送邮件')
      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' }
          : undefined,
      })
    })
  }
  return mailTransporterPromise as Promise<{ sendMail: (opts: unknown) => Promise<unknown> }>
}

async function sendEmail(channel: AlertChannelEntity, info: AlertEventInfo): Promise<void> {
  const transporter = await getMailTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'task-calculate@localhost',
    to: channel.target,
    subject: buildAlertTitle(info),
    text: buildAlertText(info).join('\n'),
  })
}

export async function sendToChannel(channel: AlertChannelEntity, info: AlertEventInfo): Promise<void> {
  switch (channel.type) {
    case 'webhook':
      return sendWebhook(channel, info)
    case 'dingtalk':
      return sendDingtalk(channel, info)
    case 'wecom':
      return sendWecom(channel, info)
    case 'email':
      return sendEmail(channel, info)
    default:
      throw new Error(`unsupported channel type: ${channel.type as string}`)
  }
}

// 发送失败重试 1 次
export async function sendWithRetry(channel: AlertChannelEntity, info: AlertEventInfo): Promise<void> {
  try {
    await sendToChannel(channel, info)
  }
  catch (err) {
    console.warn(`[alert] send to channel "${channel.name}" failed, retrying once:`, err)
    await sendToChannel(channel, info)
  }
}

// ---- 冷却（进程内；多实例部署需迁移 Redis，见 ROADMAP） ----

const lastSentAt = new Map<number, number>()

export function isCoolingDown(ruleId: number, cooldownSeconds: number, now: number = Date.now()): boolean {
  const last = lastSentAt.get(ruleId)
  return last !== undefined && now - last < cooldownSeconds * 1000
}

export function markSent(ruleId: number, now: number = Date.now()): void {
  lastSentAt.set(ruleId, now)
  // 简单防膨胀：条目过多时清理一天前的记录
  if (lastSentAt.size > 1000) {
    for (const [id, ts] of lastSentAt) {
      if (now - ts > 86_400_000) lastSentAt.delete(id)
    }
  }
}

// ---- 分发（DB 依赖部分） ----

export interface AlertDispatchInput {
  metric: MetricEntity
  systemCode: string
  prevStatus: MetricStatus
  newStatus: MetricStatus
  value: number
  reportedAt: Date
}

/** 命中任一生效中的静默窗口（指标级 > 系统级 > 全局） */
async function activeSilence(systemId: number, metricId: number, now: Date): Promise<SilenceRuleEntity | null> {
  const ds = await initDataSource()
  return ds
    .getRepository(SilenceRuleSchema)
    .createQueryBuilder('s')
    .where('s.startAt <= :now AND s.endAt >= :now', { now })
    .andWhere(
      new Brackets((qb) => {
        qb.where('s.metricId = :metricId')
          .orWhere('s.metricId IS NULL AND s.systemId = :systemId')
          .orWhere('s.metricId IS NULL AND s.systemId IS NULL')
      }),
    )
    .setParameters({ metricId, systemId })
    .getOne()
}

/**
 * 告警分发入口（ingest 管道 fire-and-forget 调用，内部自吞异常）：
 * 跃迁判定 → 静默检查 → 规则匹配 → 冷却 → 发送（失败重试 1 次）
 */
export async function dispatchAlertNotifications(input: AlertDispatchInput): Promise<void> {
  try {
    const { metric, systemCode, prevStatus, newStatus, value, reportedAt } = input
    if (!shouldNotify(prevStatus, newStatus)) return

    const now = new Date()
    const silence = await activeSilence(metric.systemId, metric.id, now)
    if (silence) {
      console.log(`[alert] ${systemCode}/${metric.code} silenced by rule #${silence.id} (${silence.reason}), skip notify`)
      return
    }

    const ds = await initDataSource()
    const system = await ds.getRepository(SystemSchema).findOne({ where: { id: metric.systemId } })
    const info: AlertEventInfo = {
      systemCode,
      systemName: system?.name ?? systemCode,
      metricCode: metric.code,
      metricName: metric.name,
      unit: metric.unit,
      value,
      status: newStatus,
      prevStatus,
      warnMin: metric.warnMin,
      warnMax: metric.warnMax,
      alarmMin: metric.alarmMin,
      alarmMax: metric.alarmMax,
      reportedAt,
    }

    const rules = await ds
      .getRepository(AlertRuleSchema)
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.channel', 'c')
      .where('r.metricId = :metricId AND r.enabled = true AND c.enabled = true', { metricId: metric.id })
      .getMany()

    const matched = rules.filter(rule => rule.channel && ruleMatchesStatus(rule, newStatus))
    if (matched.length === 0) return

    // 并行发送：原来逐个 await，渠道一多（或某个渠道超时 10s）会拖住后面的规则。
    // 冷却仍按“成功才标记”：失败的规则下次跃迁仍可重试，且每次结果都落库。
    const deliveryRepo = ds.getRepository(AlertDeliverySchema)
    await Promise.allSettled(matched.map(async (rule) => {
      if (isCoolingDown(rule.id, rule.cooldownSeconds)) return
      const channel = rule.channel as AlertChannelEntity
      try {
        await sendWithRetry(channel, info)
        markSent(rule.id)
        console.log(`[alert] notified via "${channel.name}" (rule #${rule.id})`)
        await deliveryRepo.save(deliveryRepo.create({
          ruleId: rule.id,
          channelId: channel.id,
          metricId: metric.id,
          prevStatus,
          newStatus,
          value,
          status: 'sent',
          error: null,
          reportedAt,
        })).catch(() => undefined)
      }
      catch (err) {
        console.error(`[alert] send failed for rule #${rule.id}:`, err)
        await deliveryRepo.save(deliveryRepo.create({
          ruleId: rule.id,
          channelId: channel.id,
          metricId: metric.id,
          prevStatus,
          newStatus,
          value,
          status: 'failed',
          error: String(err instanceof Error ? err.message : err).slice(0, 512),
          reportedAt,
        })).catch(() => undefined)
      }
    }))
  }
  catch (err) {
    console.error('[alert] dispatch failed:', err)
  }
}
