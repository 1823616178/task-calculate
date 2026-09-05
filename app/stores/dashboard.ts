import { defineStore } from 'pinia'
import type { SystemWithMetrics } from '../types'
import type { MetricUpdateEvent } from '../../shared/types'

// 并发中的请求（不可序列化，不放 state）：页面挂载与 WS 触发的刷新共用一次请求
let inflight: Promise<void> | null = null

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    systems: [] as SystemWithMetrics[],
    loading: false,
    lastUpdateAt: '',
  }),
  actions: {
    fetch(): Promise<void> {
      if (inflight) return inflight
      this.loading = true
      const p = $fetch<{ systems: SystemWithMetrics[] }>('/api/systems')
        .then((res) => {
          this.systems = res.systems
        })
        .finally(() => {
          inflight = null
          this.loading = false
        })
      inflight = p
      return p
    },

    // 页面挂载时调用：无数据则等待首次加载；已有数据则后台静默刷新
    async ensure(): Promise<void> {
      if (this.systems.length === 0) {
        await this.fetch()
      }
      else if (!inflight) {
        void this.fetch()
      }
    },

    // 收到 WS 推送后原地更新，看板实时刷新
    applyMetricUpdate(data: MetricUpdateEvent['data']) {
      const system = this.systems.find((s) => s.id === data.systemId)
      if (!system) return
      const metric = system.metrics.find((m) => m.id === data.metricId)
      if (!metric) {
        // 出现了本地没有的指标（别处新建），后台重新拉取一次（fetch 自带去重）
        void this.fetch()
        return
      }

      const oldStatus = metric.lastStatus
      metric.lastValue = data.value
      metric.lastStatus = data.status
      metric.lastReportedAt = data.reportedAt

      if (oldStatus !== data.status) {
        system.summary[oldStatus] = Math.max(0, (system.summary[oldStatus] ?? 1) - 1)
        system.summary[data.status] = (system.summary[data.status] ?? 0) + 1
      }
      this.lastUpdateAt = data.reportedAt
    },
  },
})
