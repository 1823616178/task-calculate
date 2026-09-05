import { connect } from 'mqtt'
import { DEMO_API_KEY } from './const'

try {
  process.loadEnvFile()
}
catch {
  // .env 不存在时使用内置默认值
}

// 联调脚本：分别以 MQTT / HTTP / WS 三种通道向平台发送演示数据。
// 用法：
//   npx tsx scripts/demo-publish.ts          三种通道各发一轮
//   npx tsx scripts/demo-publish.ts --loop   每 2 秒经 MQTT 发送随机数据（供看板演示）
// 环境变量：APP_URL（默认 http://127.0.0.1:${PORT || 48980}）、MQTT_URL（默认 mqtt://127.0.0.1:1883）

const APP_URL = process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 48980}`
const WS_URL = APP_URL.replace(/^http/, 'ws')
const MQTT_URL = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883'

function randomIn(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10
}

async function publishMqtt(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const client = connect(MQTT_URL)
    client.on('connect', () => {
      client.publish('metric/line1/temp', JSON.stringify({ apiKey: DEMO_API_KEY, value: 66 }))
      client.publish('metric/line1/humidity', JSON.stringify({ apiKey: DEMO_API_KEY, value: 55 }))
      client.publish('ingest', JSON.stringify({ apiKey: DEMO_API_KEY, systemCode: 'line1', metricCode: 'pressure', value: 100 }))
      setTimeout(() => {
        client.end()
        console.log('[demo] mqtt published: temp=66, humidity=55, pressure=100')
        resolve()
      }, 500)
    })
    client.on('error', reject)
  })
}

async function publishHttp(): Promise<void> {
  const res = await fetch(`${APP_URL}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': DEMO_API_KEY },
    body: JSON.stringify({ systemCode: 'line1', metricCode: 'pressure', value: 42 }),
  })
  console.log('[demo] http ingest:', res.status, await res.text())
}

async function publishWs(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws/ingest`)
    const timer = setTimeout(() => reject(new Error('ws demo timeout')), 8000)
    let authed = false

    ws.onopen = () => {
      ws.send(JSON.stringify({ apiKey: DEMO_API_KEY }))
    }
    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data))
      console.log('[demo] ws ingest <=', msg)
      if (msg.type === 'auth.ok' && !authed) {
        authed = true
        ws.send(JSON.stringify({ systemCode: 'line1', metricCode: 'pressure', value: 160 }))
      }
      else if (msg.type === 'ingest.ok') {
        clearTimeout(timer)
        ws.close()
        resolve()
      }
    }
    ws.onerror = (err) => {
      clearTimeout(timer)
      reject(err)
    }
  })
}

function startLoop(): void {
  const client = connect(MQTT_URL)
  client.on('connect', () => {
    console.log('[demo] loop mode: publishing random data every 2s, Ctrl+C to stop')
    setInterval(() => {
      // 大部分时间在正常区间，偶尔触发 warning / alarm
      client.publish('metric/line1/temp', JSON.stringify({ apiKey: DEMO_API_KEY, value: randomIn(20, 100) }))
      client.publish('metric/line1/humidity', JSON.stringify({ apiKey: DEMO_API_KEY, value: randomIn(20, 95) }))
      client.publish('metric/line1/pressure', JSON.stringify({ apiKey: DEMO_API_KEY, value: randomIn(60, 160) }))
    }, 2000)
  })
  client.on('error', (err) => {
    console.error('[demo] mqtt error:', err.message)
  })
}

async function main() {
  if (process.argv.includes('--loop')) {
    startLoop()
    return
  }
  await publishMqtt()
  await publishHttp()
  await publishWs()
  console.log('[demo] done')
}

main().catch((err) => {
  console.error('[demo] failed:', err)
  process.exit(1)
})
