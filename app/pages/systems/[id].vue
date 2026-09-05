<template>
  <div class="container_systemDetail">
    <AppBreadcrumb :items="breadcrumbItems" />

    <!-- 系统信息头卡 -->
    <UiCard v-if="system" class="container_systemDetail_headCard">
      <template #actions>
        <div v-if="auth.isAdmin" class="container_systemDetail_headActions">
          <UiButton variant="secondary" size="sm" @click="editVisible = true">编辑</UiButton>
          <UiButton variant="primary" size="sm" @click="createMetricVisible = true">+ 新建指标</UiButton>
        </div>
      </template>

      <div class="container_systemDetail_headBody">
        <h1 class="container_systemDetail_name">{{ system.name }}</h1>
        <code class="container_systemDetail_code">{{ system.code }}</code>
        <p class="container_systemDetail_desc">{{ system.description || '暂无描述' }}</p>
        <div class="container_systemDetail_meta">
          <span>保留：{{ retentionText }}</span>
          <span class="container_systemDetail_metaSep">·</span>
          <span>{{ metrics.length }} 个指标</span>
        </div>
      </div>
    </UiCard>

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
        :rows="metricRows"
        row-key="id"
        empty-text="暂无指标"
      >
        <template #empty>
          <UiEmpty text="暂无指标" description="先创建指标，再通过 ApiKey / MQTT / HTTP 上报数据">
            <UiButton
              v-if="auth.isAdmin && system"
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
          <MetricThresholdBar :metric="(row as MetricDto)" />
        </template>

        <template v-if="auth.isAdmin" #cell_actions="{ row }">
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

    <!-- 趋势 -->
    <section v-show="tab === 'trend'" class="container_systemDetail_tabPanel">
      <TrendChart :metrics="metrics" />
    </section>

    <!-- 告警规则 -->
    <section
      v-if="auth.isAdmin && system && tab === 'alertRules'"
      class="container_systemDetail_tabPanel container_systemDetail_tabPanel_card"
    >
      <AlertRuleManager :system-id="systemId" :metrics="metrics" />
    </section>

    <!-- 静默窗口 -->
    <section
      v-if="auth.isAdmin && system && tab === 'silences'"
      class="container_systemDetail_tabPanel container_systemDetail_tabPanel_card"
    >
      <SilenceManager :system-id="systemId" :metrics="metrics" />
    </section>

    <!-- ApiKey -->
    <section
      v-if="auth.isAdmin && system && tab === 'apiKeys'"
      class="container_systemDetail_tabPanel container_systemDetail_tabPanel_card"
    >
      <ApiKeyManager :system-id="systemId" />
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
import type { MetricDto } from '../../types'
import type { MetricStatus } from '../../../shared/types'
import type { UiColumn } from '../../components/ui/UiTable.vue'

const route = useRoute()
const auth = useAuthStore()
const dashboard = useDashboardStore()

const systemId = Number(route.params.id)
const system = computed(() => dashboard.systems.find((s) => s.id === systemId))
const metrics = computed(() => system.value?.metrics ?? [])

const breadcrumbItems = computed(() => [
  { label: '系统管理', to: '/systems' },
  { label: system.value ? `${system.value.name}（${system.value.code}）` : '系统详情' },
])

// Tabs（viewer 只能看 指标/趋势）
type TabKey = 'metrics' | 'trend' | 'alertRules' | 'silences' | 'apiKeys'

const visibleTabs = computed(() => {
  const tabs: Array<{ key: TabKey, label: string, count?: number }> = [
    { key: 'metrics', label: '指标', count: metrics.value.length },
    { key: 'trend', label: '趋势' },
  ]
  if (auth.isAdmin) {
    tabs.push(
      { key: 'alertRules', label: '告警规则' },
      { key: 'silences', label: '静默窗口' },
      { key: 'apiKeys', label: 'ApiKey' },
    )
  }
  return tabs
})

const tab = ref<TabKey>('metrics')

// URL ?tab= 同步，详情页可直接分享到指定分区
watch(visibleTabs, (tabs) => {
  if (!tabs.some((t) => t.key === tab.value)) tab.value = tabs[0]?.key ?? 'metrics'
}, { immediate: true })

onMounted(() => {
  const q = typeof route.query.tab === 'string' ? route.query.tab : ''
  if (['metrics', 'trend', 'alertRules', 'silences', 'apiKeys'].includes(q)) {
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

const retentionText = computed(() => {
  const sys = system.value
  if (!sys) return '—'
  if (sys.retentionDays === null || sys.retentionDays === undefined) return '跟随全局'
  if (sys.retentionDays === 0) return '永久'
  return `${sys.retentionDays} 天`
})

// ---- 指标表格 ----

interface MetricRow extends Record<string, unknown> {
  id: number
  code: string
  name: string
  unit: string | null
  lastValue: number | null
  lastStatus: MetricStatus
  lastReportedAt: string | null
}

const metricRows = computed<MetricRow[]>(() =>
  metrics.value.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    unit: m.unit,
    lastValue: m.lastValue,
    lastStatus: m.lastStatus,
    lastReportedAt: m.lastReportedAt,
  })),
)

const metricColumns = computed<UiColumn[]>(() => {
  const cols: UiColumn[] = [
    { key: 'code', label: '编码', width: '110px' },
    { key: 'name', label: '名称' },
  ]
  if (auth.isAdmin) {
    // 管理端把单位也并入名称列下方展示？保持原信息量：单位独立列
    cols.push({ key: 'unit', label: '单位', width: '80px' })
  }
  cols.push(
    { key: 'lastValue', label: '最新值', width: '100px', numeric: true },
    { key: 'lastStatus', label: '状态', width: '86px' },
    { key: 'lastReportedAt', label: '上报时间', width: '120px' },
    { key: 'thresholds', label: '阈值区间', width: '220px' },
  )
  if (auth.isAdmin) {
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
  margin-bottom: $space-4;
}

.container_systemDetail_headActions {
  display: flex;
  align-items: center;
  gap: $space-2;
}

.container_systemDetail_headBody {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: $space-2 $space-3;
}

.container_systemDetail_name {
  margin: 0;
  font-size: $font-xl;
  font-weight: 600;
}

.container_systemDetail_code {
  color: var(--tc-text-secondary);
}

.container_systemDetail_desc {
  width: 100%;
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_systemDetail_meta {
  width: 100%;
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

.container_systemDetail_tabPanel {
  margin-top: $space-4;
}

.container_systemDetail_tabPanel_card {
  background: $color-card-bg;
  border: 1px solid $color-border;
  border-radius: $radius-card;
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
