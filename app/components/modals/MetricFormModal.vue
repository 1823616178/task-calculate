<template>
  <UiModal
    :model-value="visible"
    size="lg"
    :title="mode === 'create' ? '新建指标' : `编辑指标「${metric?.name ?? ''}」`"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div class="container_metricFormModal_form">
      <div class="container_metricFormModal_group container_metricFormModal_basic">
        <h3 class="container_metricFormModal_groupTitle">基本信息</h3>
        <div class="container_metricFormModal_grid">
          <UiField label="指标编码" required hint="创建后不可修改" class="container_metricFormModal_code">
            <UiInput
              v-model="form.code"
              data-autofocus
              placeholder="如：speed"
              :invalid="!!errors.code"
              :disabled="mode === 'edit'"
            />
          </UiField>

          <UiField label="指标名称" required>
            <UiInput
              v-model="form.name"
              placeholder="如：车速"
              :invalid="!!errors.name"
            />
          </UiField>

          <UiField label="单位">
            <UiInput v-model="form.unit" placeholder="可选，如 ℃ / MPa / %" />
          </UiField>
        </div>
      </div>

      <div class="container_metricFormModal_group">
        <h3 class="container_metricFormModal_groupTitle">阈值区间</h3>
        <p class="container_metricFormModal_hint">
          预警区间应包含在告警区间之内；全部留空表示不做阈值判定。
        </p>
        <div class="container_metricFormModal_grid container_metricFormModal_thresholds">
          <UiField label="预警下限">
            <UiNumber v-model="form.warnMin" unit="" placeholder="-∞" :unit="undefined" />
          </UiField>
          <UiField label="预警上限">
            <UiNumber v-model="form.warnMax" placeholder="+∞" />
          </UiField>
          <UiField label="告警下限">
            <UiNumber v-model="form.alarmMin" placeholder="-∞" />
          </UiField>
          <UiField label="告警上限">
            <UiNumber v-model="form.alarmMax" placeholder="+∞" />
          </UiField>
        </div>

        <!-- 区间示意条 -->
        <div v-if="rangeBar.visible" class="container_metricFormModal_rangeBar">
          <div
            v-for="(seg, i) in rangeBar.segments"
            :key="i"
            class="container_metricFormModal_segment"
            :class="`container_metricFormModal_segment_${seg.kind}`"
            :style="{ flex: seg.weight }"
            :title="seg.title"
          >
            <span v-if="seg.label && seg.weight >= 1.2" class="container_metricFormModal_segmentLabel">{{ seg.label }}</span>
          </div>
        </div>

        <p v-if="thresholdError" class="container_metricFormModal_error" role="alert">{{ thresholdError }}</p>
      </div>
    </div>

    <template #footer>
      <UiButton variant="secondary" @click="emit('update:visible', false)">取消</UiButton>
      <UiButton variant="primary" :loading="submitting" @click="submit">
        {{ mode === 'create' ? '创建' : '保存' }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import type { MetricDto } from '../../types'

// 新建/编辑指标弹窗：基本信息 + 阈值区间两组字段，
// 带跨字段校验（预警区间包含在告警区间内）与区间示意条。
const props = defineProps<{
  visible: boolean
  mode: 'create' | 'edit'
  systemId: number
  metric?: MetricDto | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: []
}>()

const toast = useToast()
const dashboard = useDashboardStore()

const form = reactive({
  code: '',
  name: '',
  unit: '',
  warnMin: '',
  warnMax: '',
  alarmMin: '',
  alarmMax: '',
})
const errors = reactive<{ code?: string, name?: string }>({})
const thresholdError = ref('')
const submitting = ref(false)

watch(() => props.visible, (v) => {
  if (!v) return
  errors.code = ''
  errors.name = ''
  thresholdError.value = ''
  if (props.mode === 'edit' && props.metric) {
    const m = props.metric
    form.code = m.code
    form.name = m.name
    form.unit = m.unit ?? ''
    form.warnMin = m.warnMin?.toString() ?? ''
    form.warnMax = m.warnMax?.toString() ?? ''
    form.alarmMin = m.alarmMin?.toString() ?? ''
    form.alarmMax = m.alarmMax?.toString() ?? ''
  } else {
    Object.assign(form, { code: '', name: '', unit: '', warnMin: '', warnMax: '', alarmMin: '', alarmMax: '' })
  }
})

function num(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// 阈值关系校验：warnMin ≤ warnMax、alarmMin ≤ alarmMax、预警区间 ⊆ 告警区间
function validateThresholds(): boolean {
  thresholdError.value = ''
  const wMin = num(form.warnMin)
  const wMax = num(form.warnMax)
  const aMin = num(form.alarmMin)
  const aMax = num(form.alarmMax)

  if ((wMin !== null || wMax !== null) && wMin !== null && wMax !== null && wMin > wMax) {
    thresholdError.value = '预警下限不能大于预警上限'
    return false
  }
  if (aMin !== null && aMax !== null && aMin > aMax) {
    thresholdError.value = '告警下限不能大于告警上限'
    return false
  }
  if (wMin !== null && aMin !== null && wMin < aMin) {
    thresholdError.value = '预警下限不应低于告警下限（预警区间需在告警区间内）'
    return false
  }
  if (wMax !== null && aMax !== null && wMax > aMax) {
    thresholdError.value = '预警上限不应高于告警上限（预警区间需在告警区间内）'
    return false
  }
  return true
}

// 区间示意条：把正负向空间折算为分段宽度（对数软压缩避免某段占满）
const rangeBar = computed<{ visible: boolean, segments: Array<{ kind: string, weight: number, label?: string, title?: string }> }>(() => {
  const wMin = num(form.warnMin)
  const wMax = num(form.warnMax)
  const aMin = num(form.alarmMin)
  const aMax = num(form.alarmMax)
  if ([wMin, wMax, aMin, aMax].every((v) => v === null)) return { visible: false, segments: [] }

  const lower = Math.min(...[wMin, wMax, aMin].filter((v): v is number => v !== null))
  const upper = Math.max(...[wMin, wMax, aMin].filter((v): v is number => v !== null))
  // 软扩展上下边界避免边界段权重为 0
  const span = Math.max(upper - lower, Math.abs(upper), Math.abs(lower), 1)
  const lo = lower - span * 0.35
  const hi = upper + span * 0.35

  const weight = (a: number, b: number) => Math.max(0.02, Math.log10(Math.max(b - a, 0.001)) + 3)

  const segments: Array<{ kind: string, weight: number, label?: string, title?: string }> = []
  if (lo < aMin) segments.push({ kind: 'normal', weight: weight(lo, aMin), label: '正常', title: '正常区间' })
  if (wMin !== null && lo < wMin) segments.push({ kind: 'alarm', weight: weight(aMin, wMin), label: '告警', title: '告警区间（低侧）' })

  const zoneStart = wMin !== null ? wMin : aMin
  const zoneEnd = wMax !== null ? wMax : aMax
  if (zoneStart !== null && zoneEnd !== null && zoneEnd > zoneStart) {
    segments.push({ kind: 'warn', weight: weight(zoneStart, zoneEnd), label: '预警', title: '预警区间' })
  }

  if (wMax !== null && hi > wMax) segments.push({ kind: 'alarm', weight: weight(wMax, hi), label: '告警', title: '告警区间（高侧）' })
  if (hi > aMax) segments.push({ kind: 'normal', weight: weight(hi, hi), label: '', title: '' })

  const visibleSegs = segments.filter((s) => s.weight > 0.03)
  return { visible: visibleSegs.length > 0, segments: visibleSegs }
})

async function submit() {
  errors.code = ''
  errors.name = ''
  let ok = true
  if (!form.name.trim()) {
    errors.name = '请填写指标名称'
    ok = false
  }
  if (!ok) return
  if (!validateThresholds()) return

  submitting.value = true
  try {
    if (props.mode === 'create') {
      await $fetch('/api/metrics', {
        method: 'POST',
        body: {
          systemId: props.systemId,
          code: form.code.trim(),
          name: form.name.trim(),
          unit: form.unit.trim() || undefined,
          warnMin: num(form.warnMin),
          warnMax: num(form.warnMax),
          alarmMin: num(form.alarmMin),
          alarmMax: num(form.alarmMax),
        },
      })
      toast.success('指标已创建')
    } else if (props.metric) {
      await $fetch(`/api/metrics/${props.metric.id}`, {
        method: 'PUT',
        body: {
          name: form.name.trim(),
          unit: form.unit.trim() || null,
          warnMin: num(form.warnMin),
          warnMax: num(form.warnMax),
          alarmMin: num(form.alarmMin),
          alarmMax: num(form.alarmMax),
        },
      })
      toast.success('指标已保存')
    }
    await dashboard.fetch()
    emit('saved')
    emit('update:visible', false)
  } catch (err) {
    toast.error(errorMessage(err, '保存失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container_metricFormModal_form {
  display: flex;
  flex-direction: column;
  gap: $space-5;
}

.container_metricFormModal_group {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: $space-4;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  background: var(--tc-bg-subtle);
}

.container_metricFormModal_grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: $space-3 $space-4;

  &.container_metricFormModal_thresholds {
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  }
}

.container_metricFormModal_code {
  grid-column: 1;
}

.container_metricFormModal_groupTitle {
  margin: 0;
  font-size: $font-base;
  font-weight: 600;
}

.container_metricFormModal_hint {
  margin: -6px 0 0;
  color: $color-text-secondary;
  font-size: $font-xs;
}

.container_metricFormModal_error {
  margin: 0;
  color: $color-danger;
  font-size: $font-xs;
}

// 区间示意条
.container_metricFormModal_rangeBar {
  display: flex;
  width: 100%;
  height: 14px;
  border-radius: $radius-pill;
  overflow: hidden;
  border: 1px solid $color-border;
}

.container_metricFormModal_segment {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 4px;
  overflow: hidden;

  &_normal { background: var(--tc-normal-soft); }
  &_warn { background: var(--tc-warning-soft); }
  &_alarm { background: var(--tc-alarm-soft); }
}

.container_metricFormModal_segmentLabel {
  font-size: $font-xs - 1;
  color: $color-text-secondary;
  white-space: nowrap;
}
</style>
