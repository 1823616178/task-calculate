import type { MetricUpdateEvent } from '../../shared/types'

// 结构上与 crossws 的 Peer 兼容（send(string)），避免直接依赖 crossws 类型
export interface DashboardPeer {
  send(data: string): unknown
}

const peers = new Set<DashboardPeer>()

export function registerDashboardPeer(peer: DashboardPeer): void {
  peers.add(peer)
  console.log(`[ws] dashboard peer connected, total: ${peers.size}`)
}

export function unregisterDashboardPeer(peer: DashboardPeer): void {
  peers.delete(peer)
  console.log(`[ws] dashboard peer disconnected, total: ${peers.size}`)
}

export function dashboardPeerCount(): number {
  return peers.size
}

export function broadcastMetricUpdate(event: MetricUpdateEvent): void {
  if (peers.size === 0) return
  const message = JSON.stringify(event)
  for (const peer of peers) {
    try {
      peer.send(message)
    }
    catch (err) {
      console.error('[ws] failed to send to dashboard peer, removing it:', err)
      peers.delete(peer)
    }
  }
}
