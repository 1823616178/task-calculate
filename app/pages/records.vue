<template>
  <div class="container_records">
    <h1 class="container_records_title">历史记录</h1>

    <!-- 快捷时间范围 -->
    <div class="container_records_quickRange" role="group" aria-label="快捷时间范围">
      <UiButton
        v-for="q in QUICK_RANGES"
        :key="q.key"
        variant="secondary"
        size="sm"
        :class="{ container_records_quickActive: activeQuick === q.key }"
        @click="applyQuick(q)"
      >{{ q.label }}</UiButton>
    </div>

    <UiCard class="container_records_filterCard">
      <div class="container_records_filterBar">
        <UiField label="系统">
          <UiSelect v-model.number="filters.systemId" aria-label="按系统筛选">
            <option value="">全部系统</option>
            <option v-for="s in dashboard.systems" :key="s.id" :value="s.id">{{ s.name }}</option>
          </UiSelect>
        </UiField>

        <UiField label="指标">
          <UiSelect v-model.number="filters.metricId" aria-label="按指标筛选">
            <option value="">全部指标</option>
            <option v-for="m in metricOptions" :key="m.id" :value="m.id">{{ m.name }}（{{ m.code }}）</option>
          </UiSelect>
        </UiField>

        <UiField label="状态">
          <UiSelect v-model="filters.status" aria-label="按状态筛选">
            <option value="">全部状态</option>
            <option value="normal">正常</option>
            <option value="warning">预警</option>
            <option value="alarm">告警</option>
            <option value="none">未判定</option>
          </UiSelect>
        </UiField>

        <UiField label="开始时间">
          <input
            v-model="filters.from"
            type="datetime-local"
            class="container_records_time"
            aria-label="开始时间"
          >
        </UiField>

        <UiField label="结束时间">
          <input
            v-model="filters.to"
            type="datetime-local"
            class="container_records_time"
            aria-label="结束时间"
          >
        </UiField>

        <div class="container_records_filterActions">
          <UiButton variant="ghost" size="sm" @click="resetFilters">重置</UiButton>
          <UiButton variant="primary" :loading="loading && !exporting" @click="search">查询</UiButton>
          <UiButton variant="secondary" :loading="exporting" @click="exportCsv">导出 CSV</UiButton>
        </div>
      </div>

      <!-- 已选条件 chips -->
      <div v-if="activeChips.length > 0" class="container_records_chips">
        <span class="container_records_chipsLabel">已选：</span>
        <UiTag
          v-for="chip in activeChips"
          :key="chip.key"
          closable
          @close="removeChip(chip)"
        >{{ chip.label }}</UiTag>
      </div>
    </UiCard>

    <UiTable
      :columns="columns"
      :rows="records"
      row-key="id"
      :loading="loading"
      empty-text="暂无数据"
      skeleton-rows="8"
      :row-class="(r) => `container_records_row_${r.status}`"
    >
      <template #cell_system="{ row }">
        {{ systemName(row.metric?.systemId) }}
      </template>

      <template #cell_value="{ row }">
        <span
          class="container_records_value"
          :class="`container_records_value_${row.status}`"
        >{{ row.value }}{{ row.metric?.unit || '' }}</span>
      </template>

      <template #cell_status="{ row }">
        <StatusBadge :status="row.status as MetricStatus" />
      </template>

      <template #cell_reportedAt="{ row }">
        {{ formatDate(row.reportedAt) }}
      </template>
    </UiTable>

    <UiPagination
      v-model:page="page"
      v-model:page-size="pageSizeNum"
      :has-next="!!nextCursor"
      :total="total"
      :page-sizes="[20, 50, 100]"
      @update:page-size="onPageSizeChange"
    />
  </div>
</template>

<script setup lang="ts">
import type { MetricDto, RecordDto } from '../types'
import type { MetricStatus } from '../../shared/types'
import type { UiColumn } from '../components/ui/UiTable.vue'

const dashboard = useDashboardStore()
const toast = useToast()
const route = useRoute()

// 看板 KPI 卡点击跳转携带 ?status= 预填筛选
onMounted(async () => {
  const preset = typeof route.query.status === 'string' ? route.query.status : ''
  if (['normal', 'warning', 'alarm', 'none'].includes(preset)) {
    filters.status = preset as MetricStatus
  }
  await dashboard.ensure()
  await load()
})

const QUICK_RANGES = [
  { key: '1h', label: '最近 1 小时', ms: 3600_000 },
  { key: '24h', label: '最近 24 小时', ms: 24 * 3600_000 },
  { key: '7d', label: '最近 7 天', ms: 7 * 86_400_000 },
] as const

type QuickKey = (typeof QUICK_RANGES)[number]['key']

const activeQuick = ref<'' | QuickKey>('')

function applyQuick(q: { key: QuickKey, ms: number }) {
  // 再次点击同一项取消快捷选择
  if (activeQuick.value === q.key) {
    activeQuick.value = ''
    filters.from = ''
    filters.to = ''
  } else {
    activeQuick.value = q.key
    filters.to = toLocalInput(new Date())
    filters.from = toLocalInput(new Date(Date.now() - q.ms))
  }
  search()
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const filters = reactive({
  systemId: '' as '' | number,
  metricId: '' as '' | number,
  status: '' as '' | MetricStatus,
  from: '',
  to: '',
})

const records = ref<RecordDto[]>([])
const total = ref(0)
const page = ref(1)
const pageSizeNum = ref(20)
const loading = ref(false)
const exporting = ref(false)

// keyset 游标分页：currentCursor 为空表示第一页；prevStack 保存回退用的游标
const currentCursor = ref<number | null>(null)
const prevStack = ref<Array<number | null>>([])
const nextCursor = ref<number | null>(null)

const metricOptions = computed<MetricDto[]>(() => {
  if (filters.systemId === '') {
    return dashboard.systems.flatMap((s) => s.metrics)
  }
  return dashboard.systems.find((s) => s.id === Number(filters.systemId))?.metrics ?? []
})

const columns: UiColumn[] = [
  { key: 'id', label: 'ID', width: '70px', numeric: true },
  { key: 'system', label: '系统' },
  { key: 'metricName', label: '指标' },
  { key: 'value', label: '数值', width: '110px' },
  { key: 'status', label: '状态', width: '90px' },
  { key: 'channel', label: '通道', width: '80px' },
  { key: 'reportedAt', label: '上报时间', width: '170px' },
]

const STATUS_LABELS: Record<MetricStatus, string> = {
  normal: '正常',
  warning: '预警',
  alarm: '告警',
  none: '未判定',
}

interface Chip { key: string, label: string }

// 已选条件 chips（点 × 移除后自动查询）
const activeChips = computed<Chip[]>(() => {
  const chips: Chip[] = []
  if (filters.systemId !== '') {
    const sys = dashboard.systems.find((s) => s.id === Number(filters.systemId))
    chips.push({ key: 'systemId', label: `系统：${sys?.name ?? filters.systemId}` })
  }
  if (filters.metricId !== '') {
    const m = metricOptions.value.find((x) => x.id === Number(filters.metricId))
    chips.push({ key: 'metricId', label: `指标：${m ? `${m.name}（${m.code}）` : filters.metricId}` })
  }
  if (filters.status !== '') {
    chips.push({ key: 'status', label: `状态：${STATUS_LABELS[filters.status]}` })
  }
  if (filters.from) chips.push({ key: 'from', label: `从 ${formatDate(filters.from)}` })
  if (filters.to) chips.push({ key: 'to', label: `至 ${formatDate(filters.to)}` })
  return chips
})

function removeChip(chip: Chip) {
  switch (chip.key) {
    case 'systemId': filters.systemId = ''; break
    case 'metricId': filters.metricId = ''; break
    case 'status': filters.status = ''; break
    case 'from': filters.from = ''; activeQuick.value = ''; break
    case 'to': filters.to = ''; activeQuick.value = ''; break
  }
  search()
}

// 切换系统时重置指标筛选
watch(() => filters.systemId, () => {
  filters.metricId = ''
})

function systemName(systemId: number | undefined): string {
  if (systemId === undefined) return '—'
  return dashboard.systems.find((s) => s.id === systemId)?.name ?? String(systemId)
}

async function load() {
  loading.value = true
  try {
    const query: Record<string, string | number> = { pageSize: pageSizeNum.value }
    if (currentCursor.value !== null) query.beforeId = currentCursor.value
    if (filters.systemId !== '') query.systemId = Number(filters.systemId)
    if (filters.metricId !== '') query.metricId = Number(filters.metricId)
    if (filters.status !== '') query.status = filters.status
    if (filters.from) query.from = new Date(filters.from).toISOString()
    if (filters.to) query.to = new Date(filters.to).toISOString()

    const res = await $fetch<{ list: RecordDto[], total: number, nextCursor: number | null }>('/api/records', { query })
    records.value = res.list
    total.value = res.total
    nextCursor.value = res.nextCursor
  } finally {
    loading.value = false
  }
}

async function exportCsv() {
  exporting.value = true
  try {
    const params = new URLSearchParams()
    if (filters.systemId !== '') params.set('systemId', String(filters.systemId))
    if (filters.metricId !== '') params.set('metricId', String(filters.metricId))
    if (filters.status !== '') params.set('status', filters.status)
    if (filters.from) params.set('from', new Date(filters.from).toISOString())
    if (filters.to) params.set('to', new Date(filters.to).toISOString())

    // 同源 Cookie 自动携带；改为拉取 Blob 以获得完成/失败反馈（原直接跳转无任何反馈）
    const blob = await $fetch<Blob>(`/api/records/export?${params.toString()}`, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `records-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success('CSV 已导出')
  } catch (err) {
    toast.error(errorMessage(err, '导出失败'))
  } finally {
    exporting.value = false
  }
}

function search() {
  page.value = 1
  currentCursor.value = null
  prevStack.value = []
  void load()
}

async function onPageSizeChange(size: number) {
  pageSizeNum.value = size
  page.value = 1
  currentCursor.value = null
  prevStack.value = []
  await load()
}

// 游标分页的上一页 / 下一页通过 watch(page) 统一驱动
let suppressPageWatch = false

watch(page, async (p, oldP) => {
  if (suppressPageWatch) {
    suppressPageWatch = false
    return
  }
  if (p > oldP!) {
    if (nextCursor.value === null) {
      suppressPageWatch = true
      page.value = oldP!
      return
    }
    prevStack.value.push(currentCursor.value)
    currentCursor.value = nextCursor.value
  } else {
    currentCursor.value = prevStack.value.pop() ?? null
  }
  await load()
})

function resetFilters() {
  Object.assign(filters, { systemId: '', metricId: '', status: '', from: '', to: '' })
  activeQuick.value = ''
  search()
}
</script>

<style lang="scss" scoped>
.container_records {
  max-width: 1200px;
  margin: 0 auto;
  padding: $space-5 $space-4 $space-6;
}

.container_records_title {
  margin: 0 0 $space-3;
  font-size: $font-xl;
}

.container_records_quickRange {
  display: flex;
  align-items: center;
  gap: $space-2;
  margin-bottom: $space-3;
  flex-wrap: wrap;
}

.container_records_quickActive {
  border-color: var(--tc-primary);
  color: var(--tc-primary);
  background: var(--tc-primary-soft) !important;
}

.container_records_filterCard {
  margin-bottom: $space-4;
}

.container_records_filterBar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 210px));
  gap: $space-3 $space-4;
  align-items: end;

  .container_uiSelect,
  .container_uiInput {
    width: 100%;
  }
}

.container_records_time {
  width: 100%;
  height: $control-md;
  padding: 0 $space-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  background: var(--tc-card-bg);
  color: inherit;
  font-size: $font-base;

  &:focus-visible {
    outline: none;
    border-color: $color-primary;
    box-shadow: 0 0 0 2px var(--tc-focus-ring);
  }
}

.container_records_filterActions {
  display: flex;
  align-items: center;
  gap: $space-2;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.container_records_chips {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-wrap: wrap;
  margin-top: $space-3;
}

.container_records_chipsLabel {
  font-size: $font-xs;
  color: $color-text-secondary;
}

.container_records_value {
  &_warning { color: var(--tc-warning); font-weight: 600; }
  &_alarm { color: $color-alarm; font-weight: 600; }
}

// 状态左缘色条：行级视觉编码不只靠徽标颜色（作用于行首单元格）
</style>

<style lang="scss">
.container_records_row_warning > td:first-child {
  border-left: 3px solid var(--tc-warning);
}

.container_records_row_alarm > td:first-child {
  border-left: 3px solid var(--tc-alarm);
}
</style>
