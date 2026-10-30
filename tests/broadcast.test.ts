import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MetricUpdateEvent } from '../shared/types'
import {
  broadcastMetricUpdate,
  disconnectDashboardApiKey,
  registerDashboardPeer,
  unregisterDashboardPeer,
} from '../server/services/broadcastService'

const registered: Array<{ send: ReturnType<typeof vi.fn>, close: ReturnType<typeof vi.fn> }> = []

function peer() {
  const value = { send: vi.fn(), close: vi.fn() }
  registered.push(value)
  return value
}

function update(systemId: number): MetricUpdateEvent {
  return {
    type: 'metric.update',
    data: {
      systemId,
      systemCode: `line${systemId}`,
      metricId: systemId * 10,
      metricCode: 'temp',
      metricName: '温度',
      unit: '℃',
      value: 20,
      status: 'normal',
      reportedAt: '2026-09-20T00:00:00.000Z',
    },
  }
}

afterEach(() => {
  for (const value of registered.splice(0)) unregisterDashboardPeer(value)
})

describe('dashboard 广播访问范围', () => {
  it('JWT peer 收到所有系统，ApiKey peer 只收到授权系统', () => {
    const jwtPeer = peer()
    const line1Peer = peer()
    const line2Peer = peer()
    registerDashboardPeer(jwtPeer)
    registerDashboardPeer(line1Peer, [1])
    registerDashboardPeer(line2Peer, [2])

    broadcastMetricUpdate(update(1))

    expect(jwtPeer.send).toHaveBeenCalledTimes(1)
    expect(line1Peer.send).toHaveBeenCalledTimes(1)
    expect(line2Peer.send).not.toHaveBeenCalled()
  })

  it('Key 权限或系统范围变化时立即断开对应连接', () => {
    const keyPeer = peer()
    const otherKeyPeer = peer()
    const jwtPeer = peer()
    registerDashboardPeer(keyPeer, [1], 10)
    registerDashboardPeer(otherKeyPeer, [1], 11)
    registerDashboardPeer(jwtPeer)

    disconnectDashboardApiKey(10)
    broadcastMetricUpdate(update(1))

    expect(keyPeer.close).toHaveBeenCalledTimes(1)
    expect(keyPeer.send).not.toHaveBeenCalled()
    expect(otherKeyPeer.send).toHaveBeenCalledTimes(1)
    expect(jwtPeer.send).toHaveBeenCalledTimes(1)
  })
})
