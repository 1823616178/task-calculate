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

    <UiEmpty
      v-if="!hasData && !loading && !error"
      class="container_trendChart_empty"
      :text="selected.size === 0 ? '请选择至少一个指标' : '所选时间范围内暂无数据'"
      :description="selected.size === 0 ? '点击上方指标标签即可加入对比' : '可以尝试扩大时间范围，或确认数据是否正常上报'"
    />
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
  return SERIES_COLORS[metricId % SERIES_COLORS.length] ?? SERIES_COLORS[0]!
}

const chartEl = ref<HTMLElement | null>(null)
let chart: ReturnType<typeof echarts.init> | null = null

const theme = useTheme()

// ---- 修复点：原实现 ref 变量名 `window` 遮蔽全局 window，
// 导致 onMounted 里 `window.addEventListener('resize')` 抛 TypeError、监听从未注册。
// 现聚合窗口改名 bucket，并用 ResizeObserver 观察容器尺寸（覆盖标签页切换等场景）。
const selected = ref<Set<number>>(new Set(props.metrics.slice(0, 3).map((m) => m.id)))
// 首屏指标数据异步到达后自动选中前三项（仅一次，用户手动清空后不再干预）
let autoSelected = props.metrics.length > 0
watch(() => props.metrics, (metrics) => {
  if (!autoSelected && metrics.length > 0) {
    autoSelected = true
    selected.value = new Set(metrics.slice(0, 3).map(m => m.id))
  }
})
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

// 空选择也走 load()：递增请求序号，丢弃进行中的旧请求结果
watch([selected, range, bucket], () => {
  void load()
})

// ---- 主题联动：从 CSS 变量读取轴线/文字/分割线色，切换主题时重绘 ----
// 普通函数而非 computed：getComputedStyle 不是响应式依赖，computed 会永久缓存首次取值
function chartTheme() {
  return {
    textColor: getCssVar('--tc-text-secondary'),
    splitLine: getCssVar('--tc-border'),
    tooltipBg: getCssVar('--tc-card-bg'),
  }
}

function getCssVar(name: string): string {
  if (!import.meta.client) return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// data-theme 属性在 toggle 时同步写入，nextTick 后读取新变量值，用已有数据重绘，无需重新请求
let themeRedraw = false

watch(() => theme.theme.value, () => {
  if (!hasData.value) return
  void nextTick(() => {
    themeRedraw = true
    render(lastResults)
    themeRedraw = false
  })
})

function toggleMetric(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

// 请求序号：过滤慢请求竞态，只让最新一次 load() 的结果落地
let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  error.value = ''
  const ids = [...selected.value]
  if (ids.length === 0) {
    lastResults = []
    loading.value = false
    render([])
    return
  }
  loading.value = true
  try {
    const to = Date.now()
    const from = to - (RANGE_MS[range.value] ?? RANGE_MS['24h']!)
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
    if (seq !== loadSeq) return
    lastResults = results.filter((r) => r.metric)
    render(lastResults)
  } catch (err) {
    if (seq !== loadSeq) return
    const e = err as { data?: { statusMessage?: string, message?: string } }
    error.value = errorMessage(e, '加载趋势数据失败')
    hasData.value = false
  } finally {
    if (seq === loadSeq) loading.value = false
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

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

function render(results: SeriesResult[]) {
  if (!chartEl.value) return
  if (!chart) {
    chart = echarts.init(chartEl.value)
  }

  const t = chartTheme()
  const windowSeconds = results[0]?.windowSeconds ?? 300
  // x 轴使用 time 类型：刻度与数据共用原始时间戳，避免 category 轴按格式化标签匹配造成的错位
  const hasAnyPoint = results.some(r => r.points.length > 0)

  const series: Record<string, unknown>[] = []
  results.forEach(({ metric, points }, idx) => {
    if (!metric) return
    const color = colorFor(metric.id)
    const timeValue = (p: { t: string }): number => new Date(p.t).getTime()

    // 最小-最大区间带：stack 底层 + 差值半透明面积
    if (points.length > 0) {
      series.push({
        name: `${metric.name}-band-base`,
        type: 'line',
        stack: `band_${idx}`,
        // 默认 samesign 策略下负的 min 与正的差值不会叠加，区间带会画错
        stackStrategy: 'all',
        data: points.map(p => [timeValue(p), p.min] as const),
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
        stackStrategy: 'all',
        data: points.map(p => [timeValue(p), Math.max(0, p.max - p.min)] as const),
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
      symbolSize: 5,
      connectNulls: true,
      itemStyle: { color },
      lineStyle: { color, width: 2 },
      emphasis: { focus: 'series' },
      data: points.map(p => [timeValue(p), p.avg] as const),
    })
  })

  chart.setOption({
    // 首次出图与切换指标时折线自左向右展开；主题切换重绘不播放
    animation: !themeRedraw,
    animationDuration: 600,
    animationEasing: 'cubicOut',
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
        const list = params as Array<{ seriesName?: string, value: [number, number], axisValue?: number }>
        const hoverAt = list[0]?.value[0] ?? list[0]?.axisValue
        const lines: string[] = []
        for (const item of list) {
          // 只保留真实指标系列（排除 -band / -band-base 辅助系列）
          const name = item.seriesName ?? ''
          if (!results.some(r => r.metric?.name === name)) continue
          const src = results.find(r => r.metric?.name === name)
          const point = src?.points.find(p => new Date(p.t).getTime() === hoverAt)
          if (!point) continue
          // tooltip 显示当前 hover 桶的极值，而非整段数据全局极值
          const label = `${escapeHtml(name)}：均值 ${point.avg}（最小 ${point.min} / 最大 ${point.max}）`
          lines.push(label)
        }
        const tick = hoverAt !== undefined ? formatTick(new Date(hoverAt).toISOString(), windowSeconds) : ''
        return `${escapeHtml(tick)}${lines.length > 0 ? '<br/>' + lines.join('<br/>') : ''}`
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        fontSize: 11,
        color: t.textColor,
        hideOverlap: true,
        formatter: {
          year: '{MM}-{dd}',
          month: '{MM}-{dd}',
          day: '{MM}-{dd}',
          hour: '{HH}:{mm}',
          minute: '{HH}:{mm}',
          second: '{HH}:{mm}:{ss}',
          millisecond: '{HH}:{mm}:{ss}',
        } as never,
      },
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

  hasData.value = hasAnyPoint
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
  transition: border-color $dur-fast ease, background-color $dur-fast ease, color $dur-fast ease,
    transform $dur-fast $ease-out;

  &:active {
    transform: scale(0.96);
  }

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
  transition: transform $dur-base $ease-spring;
}

.container_trendChart_chip_active .container_trendChart_chipDot {
  transform: scale(1.25);
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
  animation: tc-fade $dur-slow $ease-out both;
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
  min-height: 320px;
}
</style>
