import { connect } from 'mqtt'
import type { MqttClient } from 'mqtt'
import { ingestData, IngestError } from './ingestService'
import { resolveApiKey } from '../utils/apiKey'
import { createSemaphore } from '../utils/semaphore'

let client: MqttClient | null = null
let connected = false

// 并发上限：防止消息洪峰导致不受控的并发 DB 写入；等待队列有界，溢出丢弃并记日志
const semaphore = createSemaphore(20, 500)

export function isMqttConnected(): boolean {
  return connected
}

export function stopMqttSubscriber(): void {
  if (!client) return
  const c = client
  client = null
  connected = false
  c.removeAllListeners()
  c.end(false, () => {})
}

/**
 * MQTT 接收通道：常驻订阅 EMQX，收到消息后进统一管道。
 * 主题格式：
 *   metric/{systemCode}/{metricCode}  payload 为 {"apiKey":"...","value":87.5,"timestamp":"可选"}
 *   ingest                            payload 为 {"apiKey":"...","systemCode","metricCode","value","timestamp"?}
 * payload 必须携带有效 ApiKey（与 HTTP/WS 通道一致），据此完成系统绑定隔离：
 * 通道内以 ApiKey 绑定的 systemId 校验 topic/payload 中的 systemCode，防止向任意系统写数据。
 * 断线自动重连（mqtt.js reconnectPeriod），坏消息只记日志不影响后续消息。
 */
export function startMqttSubscriber(): void {
  if (client) return

  const url = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883'
  const username = process.env.MQTT_USERNAME || undefined
  const password = process.env.MQTT_PASSWORD || undefined

  client = connect(url, {
    username,
    password,
    reconnectPeriod: 3000,
    connectTimeout: 5000,
    clientId: `task-calculate-${Math.random().toString(16).slice(2, 10)}`,
  })

  client.on('connect', () => {
    connected = true
    console.log(`[mqtt] connected to ${url}`)
    client?.subscribe(['metric/+/+', 'ingest'], (err) => {
      if (err) console.error('[mqtt] subscribe failed:', err)
      else console.log('[mqtt] subscribed topics: metric/+/+, ingest')
    })
  })

  client.on('reconnect', () => {
    console.log('[mqtt] reconnecting...')
  })
  client.on('close', () => {
    connected = false
  })
  client.on('offline', () => {
    connected = false
  })
  client.on('error', (err) => {
    connected = false
    console.error('[mqtt] error:', err.message)
  })

  client.on('message', (topic, message) => {
    void semaphore
      .run(async () => {
        let raw: unknown
        try {
          raw = JSON.parse(message.toString())
        }
        catch {
          console.warn(`[mqtt] invalid JSON on ${topic}`)
          return
        }

        try {
          // ApiKey 系统隔离：与 HTTP/WS 通道一致，凭 payload 中的 apiKey 解析出绑定系统
          const apiKeyField = typeof raw === 'object' && raw !== null
            ? (raw as Record<string, unknown>).apiKey
            : undefined
          const apiKey = await resolveApiKey(typeof apiKeyField === 'string' ? apiKeyField : undefined)
          if (!apiKey) {
            console.warn(`[mqtt] missing or invalid api key on ${topic}`)
            return
          }

          let payload: unknown = raw
          const parts = topic.split('/')
          if (parts[0] === 'metric' && parts.length === 3) {
            // 从主题补全 code；payload 中的同名字段优先（越权仍会被 expectedSystemId 拦截）
            payload = {
              systemCode: parts[1],
              metricCode: parts[2],
              ...(typeof raw === 'object' && raw !== null ? raw : { value: raw }),
            }
          }
          // 摘除 apiKey，避免凭证明文进入存储/广播
          if (typeof payload === 'object' && payload !== null && 'apiKey' in payload) {
            const { apiKey: _omit, ...rest } = payload as Record<string, unknown>
            payload = rest
          }
          const result = await ingestData(payload, 'mqtt', { expectedSystemId: apiKey.systemId })
          console.log(`[mqtt] ingested ${topic} -> status=${result.status} recordId=${result.recordId}`)
        }
        catch (err) {
          if (err instanceof IngestError) {
            console.warn(`[mqtt] rejected message on ${topic}: ${err.message}`)
          }
          else {
            console.error(`[mqtt] unexpected error on ${topic}:`, err)
          }
        }
      })
      .then((result) => {
        if (result === null) {
          console.warn(`[mqtt] ingest queue full, dropped message on ${topic}`)
        }
      })
  })
}
