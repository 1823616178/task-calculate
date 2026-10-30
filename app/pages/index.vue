<template>
  <div class="container_dashboard">
    <UiPageHead title="运行看板">
      <template #description>
        <template v-if="dashboard.systems.length > 0">
          共 {{ kpis.total }} 个系统、{{ kpis.metricTotal }} 个指标 · 最近上报 {{ relative(kpis.last) }}
        </template>
        <template v-else>实时汇总各系统指标状态</template>
      </template>
      <template v-if="auth.can('systems:manage')" #actions>
        <UiButton variant="secondary" @click="navigateTo('/systems')">管理系统</UiButton>
      </template>
    </UiPageHead>

    <!-- KPI 汇总条 -->
    <div class="container_dashboard_kpiBar">
      <component
        :is="k.to ? NuxtLinkComp : 'div'"
        v-for="(k, i) in kpiCards"
        :key="k.key"
        :to="k.to || undefined"
        class="container_dashboard_kpi"
        :class="[
          `container_dashboard_kpi_${k.key}`,
          {
            container_dashboard_kpi_static: !k.to,
            container_dashboard_kpi_zero: k.to && k.value === 0,
            container_dashboard_kpi_hot: k.key === 'alarm' && k.value > 0,
          },
        ]"
        :style="{ '--tc-enter-delay': `${i * 50}ms` }"
        :aria-label="k.to ? `查看${k.label}指标记录` : undefined"
      >
        <span class="container_dashboard_kpiIcon" aria-hidden="true">{{ k.icon }}</span>
        <span class="container_dashboard_kpiValue"><UiCountUp :value="k.value" /></span>
        <span class="container_dashboard_kpiLabel">
          {{ k.label }}
          <span v-if="k.to" class="container_dashboard_kpiArrow" aria-hidden="true">→</span>
        </span>
      </component>
    </div>

    <!-- 加载骨架 -->
    <div v-if="dashboard.loading && dashboard.systems.length === 0" class="container_dashboard_systemGrid">
      <div v-for="i in 4" :key="i" class="container_dashboard_skeletonCard">
        <UiSkeleton height="18px" width="40%" />
        <div class="container_dashboard_skeletonChips">
          <UiSkeleton v-for="j in 3" :key="j" height="16px" width="56px" />
        </div>
        <div class="container_dashboard_skeletonMetrics">
          <UiSkeleton v-for="j in 3" :key="j" variant="block" height="76px" />
        </div>
      </div>
    </div>

    <!-- 空态 -->
    <UiCard v-else-if="dashboard.systems.length === 0" class="container_dashboard_emptyCard">
      <UiEmpty text="还没有接入任何系统" description="创建第一个系统并上报指标后，看板将在此展示实时状态">
        <UiButton v-if="auth.can('systems:manage')" variant="primary" @click="navigateTo('/systems')">
          前往新建系统
        </UiButton>
      </UiEmpty>
    </UiCard>

    <!-- 系统卡片 -->
    <div v-else class="container_dashboard_systemGrid">
      <article
        v-for="(sys, i) in dashboard.systems"
        :key="sys.id"
        class="container_dashboard_systemCard"
        :class="`container_dashboard_systemCard_${worstStatus(sys)}`"
        :style="{ '--tc-enter-delay': `${Math.min(i, 8) * 40}ms` }"
        role="link"
        tabindex="0"
        :aria-label="`进入系统 ${sys.name} 详情`"
        @click="navigateTo(`/systems/${sys.id}`)"
        @keydown.enter.prevent="navigateTo(`/systems/${sys.id}`)"
      >
        <div class="container_dashboard_systemCard_header">
          <h2 class="container_dashboard_systemCard_title">{{ sys.name }}</h2>
          <code class="container_dashboard_systemCard_code">{{ sys.code }}</code>
          <span class="container_dashboard_systemCard_go" aria-hidden="true">→</span>
        </div>

        <div class="container_dashboard_systemCard_summary">
          <UiBadge
            variant="normal"
            size="sm"
            :class="{ container_dashboard_summaryZero: !(sys.summary.normal || 0) }"
          >{{ sys.summary.normal || 0 }} 正常</UiBadge>
          <UiBadge
            variant="warning"
            size="sm"
            :class="{ container_dashboard_summaryZero: !(sys.summary.warning || 0) }"
          >{{ sys.summary.warning || 0 }} 预警</UiBadge>
          <UiBadge
            variant="alarm"
            size="sm"
            :class="{ container_dashboard_summaryZero: !(sys.summary.alarm || 0) }"
          >{{ sys.summary.alarm || 0 }} 告警</UiBadge>
        </div>

        <div class="container_dashboard_metricGrid">
          <div
            v-for="m in sys.metrics.slice(0, 8)"
            :key="m.id"
            class="container_dashboard_metricCard"
            :class="`container_dashboard_metricCard_${m.lastStatus}`"
          >
            <div class="container_dashboard_metricCard_top">
              <span class="container_dashboard_metricCard_name">{{ m.name }}</span>
              <StatusBadge :status="m.lastStatus" />
            </div>
            <!-- 仅在收到新上报时闪动提示（首屏渲染不闪） -->
            <div
              class="container_dashboard_metricCard_value"
              :class="[
                `container_dashboard_metricCard_value_${m.lastStatus}`,
                { container_dashboard_metricCard_flash: flashing.has(m.id) },
              ]"
            >
              {{ m.lastValue ?? '—' }}
              <span v-if="m.unit" class="container_dashboard_metricCard_unit">{{ m.unit }}</span>
            </div>
            <MetricThresholdBar
              class="container_dashboard_metricCard_bar"
              :value="m.lastValue"
              :warn-min="m.warnMin"
              :warn-max="m.warnMax"
              :alarm-min="m.alarmMin"
              :alarm-max="m.alarmMax"
            />
            <div
              class="container_dashboard_metricCard_time"
              :class="{ container_dashboard_metricCard_time_stale: isStaleReportedAt(m.lastReportedAt) }"
            >
              {{ relative(m.lastReportedAt) }}
            </div>
          </div>
          <p v-if="sys.metrics.length === 0" class="container_dashboard_systemCard_empty">暂无指标</p>
        </div>
        <p v-if="sys.metrics.length > 8" class="container_dashboard_systemCard_more">
          还有 {{ sys.metrics.length - 8 }} 个指标…
        </p>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">

useHead({ title: '运行看板' })
import type { SystemWithMetrics } from '../types'
import type { MetricStatus } from '../../shared/types'

const auth = useAuthStore()
const dashboard = useDashboardStore()
// <component :is> 需要组件对象本身（字符串 'NuxtLink' 不会被解析）
const NuxtLinkComp = resolveComponent('NuxtLink')

const STATUS_ORDER: Record<MetricStatus, number> = { alarm: 3, warning: 2, normal: 1, none: 0 }

function worstStatus(sys: SystemWithMetrics): MetricStatus {
  let worst: MetricStatus = 'none'
  for (const m of sys.metrics) {
    const next = STATUS_ORDER[m.lastStatus]
    const cur = STATUS_ORDER[worst]
    if (next !== undefined && cur !== undefined && next > cur) worst = m.lastStatus
  }
  return worst
}

// KPI 汇总
const kpis = computed(() => {
  const agg = { total: dashboard.systems.length, metricTotal: 0, normal: 0, warning: 0, alarm: 0, last: '' as string | null }
  for (const s of dashboard.systems) {
    agg.metricTotal += s.metrics.length
    for (const m of s.metrics) {
      if (m.lastStatus === 'normal') agg.normal++
      else if (m.lastStatus === 'warning') agg.warning++
      else if (m.lastStatus === 'alarm') agg.alarm++
      if (m.lastReportedAt && (!agg.last || new Date(m.lastReportedAt).getTime() > new Date(agg.last).getTime())) {
        agg.last = m.lastReportedAt
      }
    }
  }
  return { ...agg, last: agg.last ?? '' }
})

const kpiCards = computed(() => [
  { key: 'total', label: '系统总数', value: kpis.value.total, icon: '▦', to: '' },
  { key: 'normal', label: '正常', value: kpis.value.normal, icon: '✓', to: '/records?status=normal' },
  { key: 'warning', label: '预警', value: kpis.value.warning, icon: '!', to: '/records?status=warning' },
  { key: 'alarm', label: '告警', value: kpis.value.alarm, icon: '✕', to: '/records?status=alarm' },
])

// 相对时间跟随时钟自走（此前"3 分钟前"会一直停在渲染那一刻）
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null

function relative(input: string | null | undefined): string {
  void now.value
  return formatRelative(input)
}

// 值闪动：记录每个指标已渲染过的上报时间，只有变化时才闪
const flashing = ref(new Set<number>())
const seen = new Map<number, string>()
const flashTimers = new Map<number, ReturnType<typeof setTimeout>>()

function markFlash(id: number) {
  const next = new Set(flashing.value)
  next.add(id)
  flashing.value = next
  const prevTimer = flashTimers.get(id)
  if (prevTimer) clearTimeout(prevTimer)
  flashTimers.set(id, setTimeout(() => {
    const rest = new Set(flashing.value)
    rest.delete(id)
    flashing.value = rest
    flashTimers.delete(id)
  }, 900))
}

watch(
  () => dashboard.systems.flatMap((s) => s.metrics.map((m) => [m.id, m.lastReportedAt ?? ''] as const)),
  (list) => {
    for (const [id, at] of list) {
      const prev = seen.get(id)
      seen.set(id, at)
      // 首次出现（首屏 / 新增指标）不闪，只有后续推送才闪
      if (prev !== undefined && prev !== at) markFlash(id)
    }
  },
  { immediate: true },
)

onMounted(() => {
  void dashboard.ensure()
  clock = setInterval(() => {
    now.value = Date.now()
  }, 30_000)
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
  for (const t of flashTimers.values()) clearTimeout(t)
  flashTimers.clear()
})
</script>

<style lang="scss" scoped>
.container_dashboard {
  max-width: 1440px;
  margin: 0 auto;
  padding: $space-5 $space-4 $space-6;
}

// ---- KPI 汇总条 ----
.container_dashboard_kpiBar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-4;
  margin-bottom: $space-5;

  @include down('md') {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-3;
  }
}

.container_dashboard_kpi {
  --tc-kpi-color: var(--tc-text);
  --tc-kpi-soft: var(--tc-hover);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: $space-1;
  padding: $space-4 $space-4 $space-3;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  background: $color-card-bg;
  box-shadow: var(--tc-shadow-1);
  color: $color-text;
  overflow: hidden;
  transition: transform $dur-base $ease-out, box-shadow $dur-base $ease-out,
    border-color $dur-base $ease-out;
  animation: tc-rise $dur-slow $ease-out both;
  animation-delay: var(--tc-enter-delay, 0ms);

  // 右上角柔光：状态色晕染，悬停时扩散
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 100% 0%, var(--tc-kpi-soft), transparent 55%);
    transform-origin: 100% 0%;
    transition: transform $dur-slow $ease-out;
    pointer-events: none;
  }

  &:not(.container_dashboard_kpi_static):hover {
    transform: translateY(-3px);
    box-shadow: var(--tc-shadow-2);
    border-color: var(--tc-kpi-color);

    &::after {
      transform: scale(1.6);
    }

    .container_dashboard_kpiArrow {
      opacity: 1;
      transform: none;
    }
  }

  &:active:not(.container_dashboard_kpi_static) {
    transform: translateY(-1px);
  }

  &_normal {
    --tc-kpi-color: var(--tc-normal);
    --tc-kpi-soft: var(--tc-normal-soft);
  }

  &_warning {
    --tc-kpi-color: var(--tc-warning);
    --tc-kpi-soft: var(--tc-warning-soft);
  }

  &_alarm {
    --tc-kpi-color: var(--tc-alarm);
    --tc-kpi-soft: var(--tc-alarm-soft);
  }

  &_total {
    --tc-kpi-color: var(--tc-primary);
    --tc-kpi-soft: var(--tc-primary-soft);
  }
}

.container_dashboard_kpiIcon {
  position: absolute;
  top: $space-4;
  right: $space-4;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: $radius-md;
  background: var(--tc-kpi-soft);
  color: var(--tc-kpi-color);
  font-size: $font-sm;
  font-weight: 700;
}

.container_dashboard_kpiValue {
  position: relative;
  font-size: $font-2xl + 4;
  font-weight: 700;
  line-height: 1.1;
  color: var(--tc-kpi-color);

  @include tabular-nums;
}

.container_dashboard_kpi_total .container_dashboard_kpiValue {
  color: $color-text;
}

.container_dashboard_kpiLabel {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_dashboard_kpiArrow {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity $dur-base $ease-out, transform $dur-base $ease-out;
}

// 为 0 的状态卡数字转灰，避免"0 告警"也显得刺眼
.container_dashboard_kpi_zero .container_dashboard_kpiValue {
  color: $color-text-secondary;
  opacity: 0.6;
}

// 存在告警：卡片呼吸光晕
.container_dashboard_kpi_hot {
  --tc-glow: var(--tc-alarm-soft);

  border-color: var(--tc-alarm);
  animation: tc-rise $dur-slow $ease-out both, tc-glow 2.4s ease-in-out $dur-slow infinite;
}

// ---- 骨架 ----
.container_dashboard_skeletonCard {
  background: $color-card-bg;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.container_dashboard_skeletonChips {
  display: flex;
  gap: $space-2;
}

.container_dashboard_skeletonMetrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: $space-2;
}

// ---- 系统卡片 ----
.container_dashboard_systemGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
  gap: $space-4;
}

.container_dashboard_emptyCard {
  max-width: 480px;
  margin: 0 auto;
}

.container_dashboard_systemCard {
  position: relative;
  background: $color-card-bg;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  padding: $space-4 $space-4 $space-4 $space-4 + 4;
  box-shadow: var(--tc-shadow-1);
  cursor: pointer;
  overflow: hidden;
  transition: transform $dur-base $ease-out, box-shadow $dur-base $ease-out,
    border-color $dur-base $ease-out;
  animation: tc-rise $dur-slow $ease-out both;
  animation-delay: calc(200ms + var(--tc-enter-delay, 0ms));

  // 左侧 4px 状态色条（取该系统最差状态）
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--tc-none);
    transition: background-color $dur-base $ease-out;
  }

  &_alarm::before { background: $color-alarm; }
  &_warning::before { background: var(--tc-warning); }
  &_normal::before { background: $color-normal; }

  &:hover,
  &:focus-visible {
    transform: translateY(-3px);
    box-shadow: var(--tc-shadow-2);
    outline: none;

    .container_dashboard_systemCard_go {
      opacity: 1;
      transform: none;
      color: $color-primary;
    }
  }

  &:focus-visible {
    border-color: $color-primary;
  }

  // 存在告警指标：边框转红 + 呼吸光晕
  &_alarm {
    --tc-glow: var(--tc-alarm-soft);

    border-color: var(--tc-alarm);
    animation: tc-rise $dur-slow $ease-out both, tc-glow 2.4s ease-in-out 1s infinite;
    animation-delay: calc(200ms + var(--tc-enter-delay, 0ms)), 1s;
  }
}

.container_dashboard_systemCard_go {
  margin-left: auto;
  color: $color-text-secondary;
  opacity: 0;
  transform: translateX(-6px);
  transition: opacity $dur-base $ease-out, transform $dur-base $ease-out, color $dur-base $ease-out;
}

.container_dashboard_systemCard_header {
  display: flex;
  align-items: baseline;
  gap: $space-2;
  margin-bottom: $space-3;
}

.container_dashboard_systemCard_title {
  margin: 0;
  font-size: $font-lg;
  font-weight: 600;
}

.container_dashboard_systemCard_code {
  color: $color-text-secondary;
  font-size: $font-xs;
}

.container_dashboard_systemCard_summary {
  display: flex;
  gap: $space-2;
  margin-bottom: $space-3;
  flex-wrap: wrap;
}

.container_dashboard_summaryZero {
  opacity: 0.45;
}

// ---- 指标卡 ----
.container_dashboard_metricGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  gap: $space-2;
}

.container_dashboard_metricCard {
  position: relative;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $space-2 + 2 $space-3;
  display: flex;
  flex-direction: column;
  gap: $space-1;
  background: var(--tc-bg-subtle);
  overflow: hidden;
  transition: border-color $dur-fast $ease-out, background-color $dur-fast $ease-out;

  // 顶部状态细线
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: transparent;
    transition: background-color $dur-base $ease-out;
  }

  &_normal::before { background: var(--tc-normal); }
  &_warning::before { background: var(--tc-warning); }
  &_alarm::before { background: var(--tc-alarm); }

  &_warning { background: var(--tc-warning-soft); }
  &_alarm { background: var(--tc-alarm-soft); }

  &:hover {
    border-color: var(--tc-text-secondary);
  }

  &_top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-1;
  }

  &_name {
    font-size: $font-xs;
    color: $color-text-secondary;

    @include truncate;
  }

  &_value {
    font-size: $font-xl;
    font-weight: 600;
    line-height: 1.2;

    @include tabular-nums;

    &_normal,
    &_none { color: $color-text; }
    &_warning { color: var(--tc-warning); }
    &_alarm { color: $color-alarm; }
  }

  // WS 推送到达时的闪动提示
  &_flash {
    animation: container_dashboard_flash 0.9s $ease-out;
  }

  &_unit {
    font-size: $font-xs;
    font-weight: 400;
    color: $color-text-secondary;
    margin-left: $space-1;
  }

  &_bar {
    margin-top: 2px;
  }

  &_time {
    font-size: $font-xs;
    color: $color-text-secondary;

    &_stale {
      color: $color-none;
      opacity: 0.85;
    }
  }
}

@keyframes container_dashboard_flash {
  0% {
    opacity: 0.25;
    transform: translateY(-2px);
  }

  60% {
    opacity: 1;
    transform: none;
  }

  100% {
    opacity: 1;
  }
}

.container_dashboard_systemCard_empty {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_dashboard_systemCard_more {
  margin: $space-2 0 0;
  color: $color-text-secondary;
  font-size: $font-xs;
}
</style>
