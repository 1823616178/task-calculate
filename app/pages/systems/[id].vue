<template>
  <div class="container_systemDetail">
    <AppBreadcrumb :items="breadcrumbItems" />

    <!-- 系统信息头卡 -->
    <section v-if="system" class="container_systemDetail_headCard" :class="`container_systemDetail_headCard_${worstStatus}`">
      <div class="container_systemDetail_headMain">
        <div class="container_systemDetail_headTitle">
          <h1 class="container_systemDetail_name">{{ system.name }}</h1>
          <code class="container_systemDetail_code">{{ system.code }}</code>
        </div>
        <p class="container_systemDetail_desc">{{ system.description || '暂无描述' }}</p>
        <div class="container_systemDetail_meta">
          <span>保留：{{ retentionText }}</span>
          <span class="container_systemDetail_metaSep">·</span>
          <span>{{ metrics.length }} 个指标</span>
        </div>
      </div>

      <div class="container_systemDetail_headSide">
        <div class="container_systemDetail_stats" aria-label="指标状态汇总">
          <div
            v-for="st in statusStats"
            :key="st.key"
            class="container_systemDetail_stat"
            :class="[`container_systemDetail_stat_${st.key}`, { container_systemDetail_stat_zero: st.value === 0 }]"
          >
            <span class="container_systemDetail_statValue"><UiCountUp :value="st.value" /></span>
            <span class="container_systemDetail_statLabel">{{ st.label }}</span>
          </div>
        </div>
        <div v-if="auth.can('systems:manage') || auth.can('metrics:manage')" class="container_systemDetail_headActions">
          <UiButton v-if="auth.can('systems:manage')" variant="secondary" size="sm" @click="editVisible = true">编辑</UiButton>
          <UiButton v-if="auth.can('metrics:manage')" variant="primary" size="sm" @click="createMetricVisible = true">+ 新建指标</UiButton>
        </div>
      </div>
    </section>

    <div
      v-else-if="dashboard.loading"
      class="container_systemDetail_skeletonHead"
    >
      <UiSkeleton variant="block" height="96px" />
    </div>

    <!-- 分区 Tabs -->
    <UiTabs v-if="visibleTabs.length > 0" v-model="tab" :tabs="visibleTabs" />

    <!-- 指标 -->
    <section v-show="tab === 'metrics'" class="container_systemDetail_tabPanel">
      <UiTable
        :columns="metricColumns"
        :rows="metrics"
        row-key="id"
        empty-text="暂无指标"
      >
        <template #empty>
          <UiEmpty text="暂无指标" description="先创建指标，再通过 ApiKey / MQTT / HTTP 上报数据">
            <UiButton
              v-if="auth.can('metrics:manage') && system"
              variant="primary"
              @click="createMetricVisible = true"
            >+ 新建指标</UiButton>
          </UiEmpty>
        </template>

        <template #cell_code="{ row }"><code>{{ row.code }}</code></template>

        <template #cell_unit="{ row }">{{ row.unit || '—' }}</template>

        <template #cell_lastValue="{ row }">
          <span
            class="container_systemDetail_value"
            :class="`container_systemDetail_value_${row.lastStatus}`"
          >
            {{ row.lastValue ?? '—' }}
          </span>
        </template>

        <template #cell_lastStatus="{ row }">
          <StatusBadge :status="row.lastStatus as MetricStatus" />
        </template>

        <template #cell_lastReportedAt="{ row }">
          <span :class="{ container_systemDetail_stale: isStaleReportedAt(row.lastReportedAt) }">
            {{ formatRelative(row.lastReportedAt) }}
          </span>
        </template>

        <template #cell_thresholds="{ row }">
          <MetricThresholdBar
            :value="row.lastValue"
            :warn-min="row.warnMin"
            :warn-max="row.warnMax"
            :alarm-min="row.alarmMin"
            :alarm-max="row.alarmMax"
          />
        </template>

        <template v-if="auth.can('metrics:manage')" #cell_actions="{ row }">
          <div class="container_systemDetail_rowActions">
            <UiButton variant="link" size="sm" @click="openEditMetric(row as MetricDto)">编辑</UiButton>
            <UiButton
              variant="link"
              size="sm"
              class="container_systemDetail_dangerLink"
              @click="deleteMetric(row as MetricDto)"
            >删除</UiButton>
          </div>
        </template>
      </UiTable>
    </section>

    <!-- 趋势：懒加载，首屏不引入 ECharts（约 570KB chunk） -->
    <section v-if="tab === 'trend'" class="container_systemDetail_tabPanel container_systemDetail_tabPanel_card">
      <TrendChart :metrics="metrics" />
    </section>

    <!-- 告警规则 -->
    <section
      v-if="auth.can('alerts:manage') && system && tab === 'alertRules'"
      class="container_systemDetail_tabPanel container_systemDetail_tabPanel_card"
    >
      <AlertRuleManager :system-id="systemId" :metrics="metrics" />
    </section>

    <!-- 静默窗口 -->
    <section
      v-if="auth.can('alerts:manage') && system && tab === 'silences'"
      class="container_systemDetail_tabPanel container_systemDetail_tabPanel_card"
    >
      <SilenceManager :system-id="systemId" :metrics="metrics" />
    </section>

    <SystemFormModal
      v-model:visible="editVisible"
      mode="edit"
      :system="system ?? null"
      @saved="() => void dashboard.fetch()"
    />
    <MetricFormModal
      v-model:visible="createMetricVisible"
      mode="create"
      :system-id="systemId"
      @saved="() => void dashboard.fetch()"
    />
    <MetricFormModal
      v-model:visible="editMetricVisible"
      mode="edit"
      :system-id="systemId"
      :metric="editMetricTarget"
      @saved="() => void dashboard.fetch()"
    />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { MetricDto } from '../../types'
import type { MetricStatus } from '../../../shared/types'
import type { UiColumn } from '../../components/ui/UiTable.vue'

// 覆盖 Nuxt 自动导入：仅在趋势页签首次渲染时才加载 TrendChart（及其内联的 ECharts）
const TrendChart = defineAsyncComponent(() => import('../../components/TrendChart.vue'))

const route = useRoute()
const auth = useAuthStore()
const dashboard = useDashboardStore()
const toast = useToast()

const systemId = Number(route.params.id)
const system = computed(() => dashboard.systems.find((s) => s.id === systemId))
const metrics = computed(() => system.value?.metrics ?? [])

useHead({
  title: computed(() => (system.value ? system.value.name : '系统详情')),
})

const breadcrumbItems = computed(() => [
  { label: '系统管理', to: '/systems' },
  { label: system.value ? `${system.value.name}（${system.value.code}）` : '系统详情' },
])

// Tabs（viewer 只能看 指标/趋势）
type TabKey = 'metrics' | 'trend' | 'alertRules' | 'silences'

const visibleTabs = computed(() => {
  const tabs: Array<{ key: TabKey, label: string, count?: number }> = [
    { key: 'metrics', label: '指标', count: metrics.value.length },
    { key: 'trend', label: '趋势' },
  ]
  if (auth.can('alerts:manage')) tabs.push({ key: 'alertRules', label: '告警规则' }, { key: 'silences', label: '静默窗口' })
  return tabs
})

const tab = ref<TabKey>('metrics')

// URL ?tab= 同步，详情页可直接分享到指定分区
watch(visibleTabs, (tabs) => {
  if (!tabs.some((t) => t.key === tab.value)) tab.value = tabs[0]?.key ?? 'metrics'
}, { immediate: true })

onMounted(() => {
  const q = typeof route.query.tab === 'string' ? route.query.tab : ''
  if (['metrics', 'trend', 'alertRules', 'silences'].includes(q)) {
    tab.value = q as TabKey
  }
  void dashboard.ensure()
})

watch(tab, (t) => {
  navigateTo({ query: { ...route.query, tab: t } }, { replace: true })
})

const editVisible = ref(false)
const createMetricVisible = ref(false)
const editMetricVisible = ref(false)
const editMetricTarget = ref<MetricDto | null>(null)

function openEditMetric(m: MetricDto) {
  editMetricTarget.value = m
  editMetricVisible.value = true
}

const worstStatus = computed<MetricStatus>(() => {
  const order: Record<MetricStatus, number> = { alarm: 3, warning: 2, normal: 1, none: 0 }
  return metrics.value.reduce<MetricStatus>((w, m) => (order[m.lastStatus] > order[w] ? m.lastStatus : w), 'none')
})

const statusStats = computed(() => {
  const count = (st: MetricStatus) => metrics.value.filter((m) => m.lastStatus === st).length
  return [
    { key: 'normal', label: '正常', value: count('normal') },
    { key: 'warning', label: '预警', value: count('warning') },
    { key: 'alarm', label: '告警', value: count('alarm') },
  ]
})

const retentionText = computed(() => {
  const sys = system.value
  if (!sys) return '—'
  if (sys.retentionDays === null || sys.retentionDays === undefined) return '跟随全局'
  if (sys.retentionDays === 0) return '永久'
  return `${sys.retentionDays} 天`
})

// ---- 指标表格 ----
// 行对象直接使用 MetricDto（UiTable 泛型保持插槽内类型，无需再断言）

const metricColumns = computed<UiColumn[]>(() => {
  const cols: UiColumn[] = [
    { key: 'code', label: '编码', width: '110px' },
    { key: 'name', label: '名称' },
  ]
  if (auth.can('metrics:manage')) {
    // 管理端把单位也并入名称列下方展示？保持原信息量：单位独立列
    cols.push({ key: 'unit', label: '单位', width: '80px' })
  }
  cols.push(
    { key: 'lastValue', label: '最新值', width: '100px', numeric: true },
    { key: 'lastStatus', label: '状态', width: '86px' },
    { key: 'lastReportedAt', label: '上报时间', width: '120px' },
    { key: 'thresholds', label: '阈值区间', width: '220px' },
  )
  if (auth.can('metrics:manage')) {
    cols.push({ key: 'actions', label: '操作', width: '110px' })
  }
  return cols
})

async function deleteMetric(m: MetricDto) {
  const ok = await useConfirm().ask({
    title: `删除指标「${m.name}」？`,
    message: '该指标的历史记录将一并删除。',
    danger: true,
    confirmText: '删除',
  })
  if (!ok) return
  try {
    await $fetch(`/api/metrics/${m.id}`, { method: 'DELETE' })
    await dashboard.fetch()
    toast.success(`指标「${m.name}」已删除`)
  } catch (err) {
    toast.error(errorMessage(err, '删除失败'))
  }
}
</script>

<style lang="scss" scoped>
.container_systemDetail {
  max-width: 1200px;
  margin: 0 auto;
  padding: $space-4 $space-4 $space-6;
}

.container_systemDetail_headCard {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4 $space-6;
  flex-wrap: wrap;
  margin-bottom: $space-4;
  padding: $space-5 $space-5 $space-5 $space-5 + 4;
  background: $color-card-bg;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: var(--tc-shadow-1);
  overflow: hidden;
  animation: tc-rise $dur-slow $ease-out both;

  // 左侧状态色条（与看板卡片一致）
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

  &_normal::before { background: var(--tc-normal); }
  &_warning::before { background: var(--tc-warning); }
  &_alarm::before { background: var(--tc-alarm); }
}

.container_systemDetail_headMain {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  min-width: 0;
}

.container_systemDetail_headTitle {
  display: flex;
  align-items: center;
  gap: $space-2 $space-3;
  flex-wrap: wrap;
}

.container_systemDetail_headSide {
  display: flex;
  align-items: center;
  gap: $space-5;
  flex-wrap: wrap;
}

.container_systemDetail_stats {
  display: flex;
  gap: $space-2;
}

.container_systemDetail_stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 64px;
  padding: $space-2 $space-3;
  border-radius: $radius-md;
  background: var(--tc-bg-subtle);

  &_normal { color: var(--tc-normal); background: var(--tc-normal-soft); }
  &_warning { color: var(--tc-warning); background: var(--tc-warning-soft); }
  &_alarm { color: var(--tc-alarm); background: var(--tc-alarm-soft); }

  &_zero {
    color: $color-text-secondary;
    background: var(--tc-bg-subtle);
  }
}

.container_systemDetail_statValue {
  font-size: $font-xl;
  font-weight: 700;
  line-height: 1.2;
}

.container_systemDetail_statLabel {
  font-size: $font-xs;
  opacity: 0.85;
}

.container_systemDetail_headActions {
  display: flex;
  align-items: center;
  gap: $space-2;
}

.container_systemDetail_name {
  margin: 0;
  font-size: $font-xl + 2;
  font-weight: 650;
}

.container_systemDetail_code {
  color: var(--tc-text-secondary);
}

.container_systemDetail_desc {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_systemDetail_meta {
  display: flex;
  align-items: center;
  gap: $space-2;
  color: $color-text-secondary;
  font-size: $font-xs;
}

.container_systemDetail_metaSep {
  opacity: 0.6;
}

.container_systemDetail_skeletonHead {
  margin-bottom: $space-4;
}

// Tab 切换：面板淡入上浮（v-show 从隐藏恢复显示时 CSS 动画会重新播放）
.container_systemDetail_tabPanel {
  margin-top: $space-4;
  animation: tc-rise $dur-slow $ease-out both;
}

.container_systemDetail_tabPanel_card {
  background: $color-card-bg;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  padding: $space-4;
  box-shadow: var(--tc-shadow-1);
}

.container_systemDetail_value {
  font-weight: 600;

  &_warning { color: var(--tc-warning); }
  &_alarm { color: $color-alarm; }
}

.container_systemDetail_stale {
  color: $color-text-secondary;
  opacity: 0.7;
}

.container_systemDetail_rowActions {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  white-space: nowrap;
}

.container_systemDetail_dangerLink {
  color: $color-danger !important;
}
</style>
