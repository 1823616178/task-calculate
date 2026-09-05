import { connect } from 'mqtt'
import type { MqttClient } from 'mqtt'
import { ingestData, IngestError } from './ingestService'
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
 *   metric/{systemCode}/{metricCode}  payload 为 {"value": 87.5, "timestamp": "可选"}
 *   ingest                            payload 为完整报文 {"systemCode","metricCode","value","timestamp"?}
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
          let payload: unknown = raw
          const parts = topic.split('/')
          if (parts[0] === 'metric' && parts.length === 3) {
            // 从主题补全 code，payload 中的同名字段优先
            payload = {
              systemCode: parts[1],
              metricCode: parts[2],
              ...(typeof raw === 'object' && raw !== null ? raw : { value: raw }),
            }
          }
          const result = await ingestData(payload, 'mqtt')
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
