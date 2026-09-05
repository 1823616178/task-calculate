<template>
  <div class="container_dashboard">
    <!-- KPI 汇总条 -->
    <div v-if="kpis" class="container_dashboard_kpiBar">
      <button type="button" class="container_dashboard_kpi container_dashboard_kpi_total">
        <span class="container_dashboard_kpiValue">{{ kpis.total }}</span>
        <span class="container_dashboard_kpiLabel">系统总数</span>
      </button>
      <NuxtLink
        to="/records?status=normal"
        class="container_dashboard_kpi container_dashboard_kpi_normal"
        aria-label="查看正常指标记录"
      >
        <UiBadge variant="normal" dot>{{ kpis.normal }}</UiBadge>
        <span class="container_dashboard_kpiLabel">正常</span>
      </NuxtLink>
      <NuxtLink
        to="/records?status=warning"
        class="container_dashboard_kpi container_dashboard_kpi_warning"
        aria-label="查看预警指标记录"
      >
        <UiBadge variant="warning" dot :class="{ container_dashboard_kpi_zero: kpis.warning === 0 }">{{ kpis.warning }}</UiBadge>
        <span class="container_dashboard_kpiLabel">预警</span>
      </NuxtLink>
      <NuxtLink
        to="/records?status=alarm"
        class="container_dashboard_kpi container_dashboard_kpi_alarm"
        aria-label="查看告警指标记录"
      >
        <UiBadge variant="alarm" dot :class="{ container_dashboard_kpi_zero: kpis.alarm === 0 }">{{ kpis.alarm }}</UiBadge>
        <span class="container_dashboard_kpiLabel">告警</span>
      </NuxtLink>
      <div class="container_dashboard_kpi container_dashboard_kpi_time">
        <span class="container_dashboard_kpiValueTime">{{ formatRelative(kpis.last) }}</span>
        <span class="container_dashboard_kpiLabel">最近上报</span>
      </div>
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
        <UiButton v-if="auth.isAdmin" variant="primary" @click="navigateTo('/systems')">
          前往新建系统
        </UiButton>
      </UiEmpty>
    </UiCard>

    <!-- 系统卡片 -->
    <div v-else class="container_dashboard_systemGrid">
      <article
        v-for="sys in dashboard.systems"
        :key="sys.id"
        class="container_dashboard_systemCard"
        :class="`container_dashboard_systemCard_${worstStatus(sys)}`"
        role="link"
        tabindex="0"
        :aria-label="`进入系统 ${sys.name} 详情`"
        @click="navigateTo(`/systems/${sys.id}`)"
        @keydown.enter.prevent="navigateTo(`/systems/${sys.id}`)"
      >
        <div class="container_dashboard_systemCard_header">
          <h2 class="container_dashboard_systemCard_title">{{ sys.name }}</h2>
          <code class="container_dashboard_systemCard_code">{{ sys.code }}</code>
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
          >
            <div class="container_dashboard_metricCard_top">
              <span class="container_dashboard_metricCard_name">{{ m.name }}</span>
              <StatusBadge :status="m.lastStatus" />
            </div>
            <!-- key 变化触发重挂载 → WS 更新时值区块闪动提示 -->
            <div
              :key="m.lastReportedAt ?? 'never'"
              :class="`container_dashboard_metricCard_value container_dashboard_metricCard_value_${m.lastStatus}`"
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
              :class="{ container_dashboard_metricCard_stale: isStaleReportedAt(m.lastReportedAt) }"
            >
              {{ formatRelative(m.lastReportedAt) }}
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
import type { SystemWithMetrics } from '../types'
import type { MetricStatus } from '../../shared/types'

const auth = useAuthStore()
const dashboard = useDashboardStore()

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
  const agg = { total: dashboard.systems.length, normal: 0, warning: 0, alarm: 0, last: '' as string | null }
  for (const s of dashboard.systems) {
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

onMounted(() => {
  void dashboard.ensure()
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
  grid-template-columns: repeat(auto-fit, minmax(120px, 160px));
  gap: $space-3;
  margin-bottom: $space-5;
}

.container_dashboard_kpi {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: $space-2;
  padding: $space-3 $space-4;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-card-bg;
  box-shadow: var(--tc-shadow-1);
  text-align: left;
  cursor: pointer;
  transition: transform $dur-base $ease-out, box-shadow $dur-base $ease-out;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--tc-shadow-2);
  }

  &_time {
    cursor: default;

    &:hover {
      transform: none;
    }
  }
}

.container_dashboard_kpiValue {
  font-size: $font-2xl;
  font-weight: 700;
  line-height: 1;

  @include tabular-nums;
}

.container_dashboard_kpiValueTime {
  font-size: $font-lg;
  font-weight: 600;
  color: $color-text;
}

.container_dashboard_kpiLabel {
  color: $color-text-secondary;
  font-size: $font-xs;
}

.container_dashboard_kpi_alarm:hover {
  border-color: var(--tc-alarm);
}

.container_dashboard_kpi_warning:hover {
  border-color: var(--tc-warning);
}

.container_dashboard_kpi_normal:hover {
  border-color: $color-normal;
}

.container_dashboard_kpi_zero {
  opacity: 0.45;
}

// ---- 骨架 ----
.container_dashboard_skeletonCard {
  background: $color-card-bg;
  border: 1px solid $color-border;
  border-radius: $radius-card;
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
  border-radius: $radius-card;
  padding: $space-4;
  box-shadow: var(--tc-shadow-1);
  cursor: pointer;
  overflow: hidden;
  transition: transform $dur-base $ease-out, box-shadow $dur-base $ease-out;

  // 左侧 4px 状态色条（取该系统最差状态）
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--tc-none);
  }

  &_alarm::before { background: $color-alarm; }
  &_warning::before { background: var(--tc-warning); }
  &_normal::before { background: $color-normal; }

  &:hover,
  &:focus-visible {
    transform: translateY(-2px);
    box-shadow: var(--tc-shadow-2);
    outline: none;
  }
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
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $space-2 $space-3;
  display: flex;
  flex-direction: column;
  gap: $space-1;
  background: var(--tc-bg-subtle);

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

  // WS 推送到达时的闪动提示（值为动画容器）
  .container_dashboard_metricCard_value {
    animation: container_dashboard_flash 0.9s ease-out;
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
