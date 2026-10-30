<template>
  <!-- 迷你趋势：看板指标卡只给当前值 + 阈值条，想看走势必须点进详情页；
       这里用轻量 SVG 折线（不引入 ECharts）补 24h 均值走势。
       进入视口才请求，避免看板一屏发几十个 stats 请求。 -->
  <div ref="rootEl" class="container_metricSparkline" :aria-label="label">
    <svg
      v-if="points.length >= 2"
      class="container_metricSparkline_svg"
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        :points="polyline"
        fill="none"
        :stroke="stroke"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <span v-else-if="loaded" class="container_metricSparkline_none">暂无趋势</span>
  </div>
</template>

<script setup lang="ts">
import type { MetricStatus } from '../../../shared/types'

const props = defineProps<{
  metricId: number
  status: MetricStatus
}>()

const STATUS_STROKE: Record<MetricStatus, string> = {
  normal: 'var(--tc-normal)',
  warning: 'var(--tc-warning)',
  alarm: 'var(--tc-alarm)',
  none: 'var(--tc-none)',
}

const rootEl = ref<HTMLElement | null>(null)
const points = ref<number[]>([])
const loaded = ref(false)
const stroke = computed(() => STATUS_STROKE[props.status] ?? STATUS_STROKE.none)
const label = computed(() => `最近 24 小时均值趋势`)

const polyline = computed(() => {
  const values = points.value
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values.map((v, i) => {
    const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 100
    const y = 26 - ((v - min) / span) * 24
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

let observer: IntersectionObserver | null = null

async function load(): Promise<void> {
  if (loaded.value) return
  loaded.value = true
  try {
    const to = Date.now()
    const from = to - 24 * 3600_000
    const res = await $fetch<{
      points: Array<{ avg: number }>
    }>(`/api/metrics/${props.metricId}/stats`, {
      query: { window: 'auto', from: new Date(from).toISOString(), to: new Date(to).toISOString() },
    })
    points.value = res.points.map(p => p.avg)
  }
  catch {
    points.value = []
  }
}

onMounted(() => {
  if (!rootEl.value || typeof IntersectionObserver === 'undefined') {
    void load()
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) {
      void load()
      observer?.disconnect()
      observer = null
    }
  }, { rootMargin: '200px' })
  observer.observe(rootEl.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<style lang="scss" scoped>
.container_metricSparkline {
  height: 28px;
  width: 100%;
}

.container_metricSparkline_svg {
  width: 100%;
  height: 100%;
  display: block;
}

.container_metricSparkline_none {
  font-size: $font-xs;
  color: $color-text-secondary;
}
</style>
