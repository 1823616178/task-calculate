<template>
  <div class="container_trendChart">
    <div class="container_trendChart_toolbar">
      <!-- 指标多选：可横向滚动 chips -->
      <div class="container_trendChart_chips" role="group" aria-label="选择指标">
        <button
          v-for="m in metrics"
          :key="m.id"
          type="button"
          class="container_trendChart_chip"
          :class="{ container_trendChart_chip_active: selected.has(m.id) }"
          :aria-pressed="selected.has(m.id) ? 'true' : 'false'"
          @click="toggleMetric(m.id)"
        >
          <span
            class="container_trendChart_chipDot"
            :style="{ background: colorFor(m.id) }"
            aria-hidden="true"
          />
          {{ m.name }}
        </button>
      </div>

      <div class="container_trendChart_controls">
        <UiSelect v-model="range" size="sm" aria-label="时间范围">
          <option value="1h">最近 1 小时</option>
          <option value="6h">最近 6 小时</option>
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
        </UiSelect>
        <UiSelect v-model="bucket" size="sm" aria-label="聚合窗口">
          <option value="auto">自动窗口</option>
          <option value="1m">按 1 分钟</option>
          <option value="5m">按 5 分钟</option>
          <option value="15m">按 15 分钟</option>
          <option value="1h">按 1 小时</option>
          <option value="1d">按 1 天</option>
        </UiSelect>
        <UiButton variant="secondary" size="sm" :loading="loading" @click="() => void load()">
          刷新
        </UiButton>
        <UiButton variant="secondary" size="sm" :disabled="!hasData || loading" @click="exportPng">
          导出 PNG
        </UiButton>
      </div>
    </div>

    <!-- 错误态：重试按钮 -->
    <div v-if="error" class="container_trendChart_errorState" role="alert">
      <p class="container_trendChart_error">{{ error }}</p>
      <UiButton variant="secondary" size="sm" @click="() => void load()">重试</UiButton>
    </div>

    <!-- 加载骨架 -->
    <div v-if="loading && !hasData" class="container_trendChart_skeleton">
      <UiSkeleton variant="block" height="100%" />
    </div>

    <div v-show="hasData && !error" ref="chartEl" class="container_trendChart_canvas" />

    <p
      v-if="!hasData && !loading && !error && selected.size >= 0"
      class="container_trendChart_empty"
    >
      {{ selected.size === 0 ? '请选择至少一个指标' : '所选时间范围内暂无数据' }}
    </p>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { MetricDto } from '../types'
import { useTheme } from '../composables/useTheme'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer])

const props = defineProps<{ metrics: MetricDto[] }>()

const RANGE_MS: Record<string, number> = {
  '1h': 3600_000,
  '6h': 6 * 3600_000,
  '24h': 24 * 3600_000,
  '7d': 7 * 86_400_000,
}

// 系列配色：从语义变量生成稳定色板（每个指标按 id 分配）
const SERIES_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444']

function colorFor(metricId: number): string {
  return SERIES_COLORS[metricId % SERIES_COLORS.length]
}

const chartEl = ref<HTMLElement | null>(null)
let chart: ReturnType<typeof echarts.init> | null = null

const theme = useTheme()

// ---- 修复点：原实现 ref 变量名 `window` 遮蔽全局 window，
// 导致 onMounted 里 `window.addEventListener('resize')` 抛 TypeError、监听从未注册。
// 现聚合窗口改名 bucket，并用 ResizeObserver 观察容器尺寸（覆盖标签页切换等场景）。
const selected = ref<Set<number>>(new Set(props.metrics.slice(0, 3).map((m) => m.id)))
const range = ref<'1h' | '6h' | '24h' | '7d'>('24h')
const bucket = ref<'auto' | '1m' | '5m' | '15m' | '1h' | '1d'>('auto')
const loading = ref(false)
const error = ref('')
const hasData = ref(false)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  void load()
  if (chartEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      chart?.resize()
    })
    resizeObserver.observe(chartEl.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  chart?.dispose()
  chart = null
})

watch([selected, range, bucket], () => {
  if (selected.value.size > 0) void load()
  else {
    hasData.value = false
    render([])
  }
})

// ---- 主题联动：从 CSS 变量读取轴线/文字/分割线色，切换主题时重绘 ----
const chartTheme = computed(() => ({
  textColor: getCssVar('--tc-text-secondary'),
  splitLine: getCssVar('--tc-border'),
  tooltipBg: getCssVar('--tc-card-bg'),
}))

function getCssVar(name: string): string {
  if (!import.meta.client) return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

watch(chartTheme, () => {
  // 已有数据时仅重新应用样式（notMerge=false 合并更新）
  if (hasData.value) void load()
})

watch(() => theme.theme.value, () => {
  if (hasData.value) void load()
})

function toggleMetric(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

async function load() {
  error.value = ''
  const ids = [...selected.value]
  if (ids.length === 0) {
    render([])
    return
  }
  loading.value = true
  try {
    const to = Date.now()
    const from = to - RANGE_MS[range.value]
    const results = await Promise.all(
      ids.map(async (metricId) => {
        const metric = props.metrics.find((m) => m.id === metricId)
        const res = await $fetch<{
          points: Array<{ t: string, min: number, max: number, avg: number, count: number }>
          windowSeconds: number
        }>(`/api/metrics/${metricId}/stats`, {
          query: { window: bucket.value, from: new Date(from).toISOString(), to: new Date(to).toISOString() },
        })
        return { metric, ...res }
      }),
    )
    lastResults = results.filter((r) => r.metric)
    render(lastResults)
  } catch (err) {
    const e = err as { data?: { statusMessage?: string, message?: string } }
    error.value = errorMessage(e, '加载趋势数据失败')
    hasData.value = false
  } finally {
    loading.value = false
  }
}

interface SeriesResult {
  metric?: MetricDto
  points: Array<{ t: string, min: number, max: number, avg: number, count: number }>
  windowSeconds: number
}

let lastResults: SeriesResult[] = []

function formatTick(iso: string, windowSeconds: number): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (windowSeconds >= 86_400) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (windowSeconds >= 3600) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
  return hm
}

function render(results: SeriesResult[]) {
  if (!chartEl.value) return
  if (!chart) {
    chart = echarts.init(chartEl.value)
  }

  const t = chartTheme.value
  const windowSeconds = results[0]?.windowSeconds ?? 300
  // x 轴取所有序列时间点的并集（各指标数据可能不齐）
  const ticks = [...new Set(results.flatMap(r => r.points.map(p => p.t)))].sort()
  const tickLabels = new Map(ticks.map(tt => [tt, formatTick(tt, windowSeconds)]))

  const series: Record<string, unknown>[] = []
  results.forEach(({ metric, points }, idx) => {
    if (!metric) return
    const color = colorFor(metric.id)

    // 最小-最大区间带：stack 底层 + 差值半透明面积
    if (points.length > 0) {
      series.push({
        name: `${metric.name}-band-base`,
        type: 'line',
        stack: `band_${idx}`,
        data: points.map(p => [p.t as never as number, p.min]),
        lineStyle: { opacity: 0 },
        symbol: 'none',
        silent: true,
        emphasis: { disabled: true },
        legendHoverLink: false,
      })
      series.push({
        name: `${metric.name}-band`,
        type: 'line',
        stack: `band_${idx}`,
        data: points.map(p => [p.t as never as number, Math.max(0, p.max - p.min)]),
        areaStyle: { color, opacity: 0.08 },
        lineStyle: { opacity: 0 },
        symbol: 'none',
        silent: true,
        emphasis: { disabled: true },
        legendHoverLink: false,
      })
    }

    series.push({
      name: metric.name,
      type: 'line',
      showSymbol: points.length <= 60,
      connectNulls: true,
      itemStyle: { color },
      lineStyle: { color, width: 2 },
      data: points.map(p => [p.t as never as number, p.avg]),
      tooltip: {
        min: points.length > 0 ? Math.min(...points.map(p => p.min)) : '—',
        max: points.length > 0 ? Math.max(...points.map(p => p.max)) : '—',
      },
    })
  })

  chart.setOption({
    animation: false,
    color: SERIES_COLORS,
    grid: { left: 48, right: 16, top: 32, bottom: 40 },
    legend: {
      top: 0,
      textStyle: { color: t.textColor, fontSize: 11 },
      selectedMode: false,
      // 区间带辅助系列不进入图例
      data: results.map(r => r.metric?.name ?? '').filter(Boolean),
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: t.tooltipBg,
      borderColor: t.splitLine,
      textStyle: { color: t.textColor, fontSize: 12 },
      formatter(params: unknown) {
        const list = params as Array<{ seriesName?: string, value: [string, number] }>
        const lines: string[] = []
        for (const item of list) {
          if (!item.seriesName || item.seriesName.endsWith('-band')) continue
          const name = item.seriesName.replace(/-band-base$/, '')
          const src = results.find(r => r.metric?.name === name)
          if (!src || src.points.length === 0) continue
          const min = Math.min(...src.points.map(p => p.min))
          const max = Math.max(...src.points.map(p => p.max))
          lines.push(`${item.seriesName}：均值 ${item.value[1]}（最小 ${min} / 最大 ${max}）`)
        }
        return `${tickLabels.get(list[0]?.value[0] ?? '') ?? ''}${lines.length > 0 ? '<br/>' + lines.join('<br/>') : ''}`
      },
    },
    xAxis: {
      type: 'category',
      data: ticks.map(tt => tickLabels.get(tt) ?? tt),
      axisLabel: { fontSize: 11, color: t.textColor },
      axisLine: { lineStyle: { color: t.splitLine } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { fontSize: 11, color: t.textColor },
      splitLine: { lineStyle: { color: t.splitLine } },
    },
    series,
  }, { notMerge: true })

  hasData.value = ticks.length > 0
}

function exportPng() {
  if (!chart || !hasData.value) return
  // 填充主题底色再导出，避免透明底在查看器里发黑
  const url = chart.getDataURL({ pixelRatio: 2, backgroundColor: getCssVar('--tc-card-bg') })
  const a = document.createElement('a')
  a.href = url
  a.download = `trend-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
</script>

<style lang="scss" scoped>
.container_trendChart {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.container_trendChart_toolbar {
  display: flex;
  align-items: center;
  gap: $space-3;
  flex-wrap: wrap;
  justify-content: space-between;
}

.container_trendChart_chips {
  display: flex;
  align-items: center;
  gap: $space-2;

  @include scrollbar;

  flex-wrap: nowrap;
  overflow-x: auto;
  max-width: 100%;
  padding-bottom: 2px;
}

.container_trendChart_chip {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  height: $control-sm;
  padding: 0 $space-3;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: var(--tc-card-bg);
  font-size: $font-sm;
  color: $color-text-secondary;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color $dur-fast ease, background-color $dur-fast ease, color $dur-fast ease;

  &:hover {
    border-color: $color-text-secondary;
    color: $color-text;
  }

  &_active {
    border-color: var(--tc-primary);
    color: var(--tc-primary);
    background: var(--tc-primary-soft);

    &:hover {
      border-color: var(--tc-primary);
    }
  }
}

.container_trendChart_chipDot {
  width: 8px;
  height: 8px;
  border-radius: $radius-pill;
  flex-shrink: 0;
}

.container_trendChart_controls {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-wrap: wrap;
}

.container_trendChart_canvas {
  width: 100%;
  height: 320px;
}

.container_trendChart_skeleton {
  height: 320px;
}

.container_trendChart_errorState {
  display: flex;
  align-items: center;
  gap: $space-3;
}

.container_trendChart_error {
  margin: 0;
  color: $color-danger;
  font-size: $font-sm;
}

.container_trendChart_empty {
  text-align: center;
  color: $color-text-secondary;
  padding: $space-6 0;
}
</style>
