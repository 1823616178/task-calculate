<template>
  <div class="container_silenceManager">
    <div class="container_silenceManager_head">
      <p class="container_silenceManager_desc">静默窗口内的上报不触发任何通知（维护期免打扰）</p>
      <UiButton variant="primary" size="sm" @click="createVisible = true">+ 新建静默</UiButton>
    </div>

    <UiTable
      :columns="columns"
      :rows="silences"
      row-key="id"
      :loading="loading"
      empty-text="暂无静默窗口"
      skeleton-rows="3"
    >
      <template #cell_scope="{ row }">{{ scopeText(row as SilenceRuleDto) }}</template>

      <template #cell_window="{ row }">
        <span class="container_silenceManager_window">
          {{ formatDate((row as SilenceRuleDto).startAt) }} ~ {{ formatDate((row as SilenceRuleDto).endAt) }}
        </span>
      </template>

      <template #cell_reason="{ row }">{{ (row as SilenceRuleDto).reason || '—' }}</template>

      <template #cell_phase="{ row }">
        <span
          class="container_silenceManager_phase container_silenceManager_phase_active"
          :class="`container_silenceManager_phase_${phase(row as SilenceRuleDto)}`"
        >{{ phaseLabel(row as SilenceRuleDto) }}</span>
      </template>

      <template #cell_actions="{ row }">
        <UiButton
          variant="link"
          size="sm"
          class="container_silenceManager_dangerLink"
          @click="remove(row as SilenceRuleDto)"
        >删除</UiButton>
      </template>
    </UiTable>

    <SilenceFormModal
      v-model:visible="createVisible"
      :system-id="systemId"
      :metrics="metrics"
      @saved="() => void load()"
    />
  </div>
</template>

<script setup lang="ts">
import type { MetricDto, SilenceRuleDto } from '../types'
import type { UiColumn } from '../components/ui/UiTable.vue'

const props = defineProps<{ systemId: number, metrics: MetricDto[] }>()

const toast = useToast()

const silences = ref<SilenceRuleDto[]>([])
const loading = ref(false)
const createVisible = ref(false)

const columns: UiColumn[] = [
  { key: 'scope', label: '作用范围', width: '150px' },
  { key: 'window', label: '时间窗' },
  { key: 'reason', label: '原因' },
  { key: 'phase', label: '状态', width: '90px' },
  { key: 'actions', label: '操作', width: '70px' },
]

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ silences: SilenceRuleDto[] }>('/api/alert/silences', { query: { systemId: props.systemId } })
    silences.value = res.silences
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

function scopeText(s: SilenceRuleDto): string {
  if (s.metricId !== null) return `指标：${s.metric?.name ?? s.metricId}`
  if (s.systemId !== null) return `系统：${s.system?.name ?? s.systemId}`
  return '全局'
}

function phase(s: SilenceRuleDto): 'active' | 'upcoming' | 'expired' {
  const now = Date.now()
  const start = new Date(s.startAt).getTime()
  const end = new Date(s.endAt).getTime()
  if (now < start) return 'upcoming'
  if (now > end) return 'expired'
  return 'active'
}

function phaseLabel(s: SilenceRuleDto): string {
  const p = phase(s)
  return p === 'active' ? '生效中' : p === 'upcoming' ? '未开始' : '已结束'
}

async function remove(s: SilenceRuleDto) {
  const ok = await useConfirm().ask({
    title: '删除该静默窗口？',
    message: `范围：${scopeText(s)}。删除后窗口内的上报将恢复通知。`,
    danger: true,
    confirmText: '删除',
  })
  if (!ok) return
  try {
    await $fetch(`/api/alert/silences/${s.id}`, { method: 'DELETE' })
    await load()
    toast.success('静默窗口已删除')
  } catch (err) {
    toast.error(errorMessage(err, '删除失败'))
  }
}
</script>

<style lang="scss" scoped>
.container_silenceManager_head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-3;
}

.container_silenceManager_desc {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_silenceManager_window {
  @include tabular-nums;

  white-space: nowrap;
}

.container_silenceManager_phase {
  font-size: $font-xs;
}

.container_silenceManager_phase_active { color: $color-normal; }
.container_silenceManager_phase_upcoming { color: var(--tc-warning); }
.container_silenceManager_phase_expired { color: $color-text-secondary; }

.container_silenceManager_dangerLink {
  color: $color-danger !important;
}
</style>
