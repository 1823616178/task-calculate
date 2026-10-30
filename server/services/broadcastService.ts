import type { MetricUpdateEvent } from '../../shared/types'

// 结构上与 crossws 的 Peer 兼容（send(string)），避免直接依赖 crossws 类型
export interface DashboardPeer {
  send(data: string): unknown
  close?(): unknown
}

interface DashboardPeerAccess {
  // null 表示全部系统；Set 表示 ApiKey 被授权的系统集合。
  systemIds: Set<number> | null
  // JWT 连接为 null；用于权限或生命周期变化时立即断开对应 Key 的连接。
  apiKeyId: number | null
}

const peers = new Map<DashboardPeer, DashboardPeerAccess>()

export function registerDashboardPeer(peer: DashboardPeer, systemIds: number[] | null = null, apiKeyId: number | null = null): void {
  peers.set(peer, { systemIds: systemIds === null ? null : new Set(systemIds), apiKeyId })
  console.log(`[ws] dashboard peer connected, total: ${peers.size}`)
}

export function unregisterDashboardPeer(peer: DashboardPeer): void {
  peers.delete(peer)
  console.log(`[ws] dashboard peer disconnected, total: ${peers.size}`)
}

export function dashboardPeerCount(): number {
  return peers.size
}

export function disconnectDashboardApiKey(apiKeyId: number): void {
  for (const [peer, access] of peers) {
    if (access.apiKeyId !== apiKeyId) continue
    peers.delete(peer)
    try {
      peer.close?.()
    }
    catch (err) {
      console.error('[ws] failed to close dashboard peer:', err)
    }
  }
}

export function broadcastMetricUpdate(event: MetricUpdateEvent): void {
  if (peers.size === 0) return
  const message = JSON.stringify(event)
  for (const [peer, { systemIds }] of peers) {
    if (systemIds !== null && !systemIds.has(event.data.systemId)) continue
    try {
      peer.send(message)
    }
    catch (err) {
      console.error('[ws] failed to send to dashboard peer, removing it:', err)
      peers.delete(peer)
    }
  }
}
