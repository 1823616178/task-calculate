<template>
  <UiModal
    :model-value="visible"
    size="md"
    title="新建静默窗口"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div class="container_silenceFormModal_form">
      <div class="container_silenceFormModal_grid">
        <UiField label="作用范围" required>
          <UiSelect v-model="form.scope" data-autofocus>
            <option value="system">本系统</option>
            <option value="metric">指定指标</option>
            <option value="global">全局</option>
          </UiSelect>
        </UiField>

        <UiField v-if="form.scope === 'metric'" label="指标" required>
          <UiSelect v-model="form.metricId" :invalid="!!errors.metricId">
            <option value="" disabled>选择指标</option>
            <option v-for="m in metrics" :key="m.id" :value="m.id">
              {{ m.name }}（{{ m.code }}）
            </option>
          </UiSelect>
        </UiField>
      </div>

      <div class="container_silenceFormModal_quick">
        <span class="container_silenceFormModal_quickLabel">快捷设置：</span>
        <UiButton
          v-for="h in QUICK_HOURS"
          :key="h"
          variant="secondary"
          size="sm"
          @click="applyQuick(h)"
        >
          接下来 {{ h }} 小时
        </UiButton>
      </div>

      <div class="container_silenceFormModal_grid">
        <UiField label="开始时间" required>
          <input
            v-model="form.startAt"
            type="datetime-local"
            class="container_silenceFormModal_time"
            :aria-invalid="!!errors.time"
          >
        </UiField>
        <UiField label="结束时间" required>
          <input
            v-model="form.endAt"
            type="datetime-local"
            class="container_silenceFormModal_time"
            :aria-invalid="!!errors.time"
          >
        </UiField>
      </div>
      <p v-if="errors.time" class="container_silenceFormModal_error" role="alert">{{ errors.time }}</p>

      <UiField label="原因">
        <UiInput v-model="form.reason" placeholder="如：计划检修 / 版本发布窗口" />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="secondary" @click="emit('update:visible', false)">取消</UiButton>
      <UiButton variant="primary" :loading="submitting" @click="submit">创建</UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import type { MetricDto } from '../../types'

// 新建静默弹窗：作用域/起止时间/原因 + 快捷"接下来 1/4/8 小时"
const props = defineProps<{
  visible: boolean
  systemId: number
  metrics: MetricDto[]
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: []
}>()

const toast = useToast()

const QUICK_HOURS = [1, 4, 8]

const form = reactive({
  scope: 'system' as 'system' | 'metric' | 'global',
  metricId: '' as '' | number,
  startAt: '',
  endAt: '',
  reason: '',
})
const errors = reactive<{ metricId?: string, time?: string }>({})
const submitting = ref(false)

watch(() => props.visible, (v) => {
  if (!v) return
  Object.assign(form, { scope: 'system', metricId: '', startAt: '', endAt: '', reason: '' })
  errors.metricId = undefined
  errors.time = undefined
})

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function applyQuick(hours: number) {
  const now = new Date()
  form.startAt = toLocalInput(now)
  form.endAt = toLocalInput(new Date(now.getTime() + hours * 3600_000))
}

async function submit() {
  errors.metricId = undefined
  errors.time = undefined
  let ok = true

  if (form.scope === 'metric' && form.metricId === '') {
    errors.metricId = '请选择指标'
    ok = false
  }
  if (!form.startAt || !form.endAt) {
    errors.time = '请选择起止时间'
    ok = false
  } else if (new Date(form.endAt).getTime() <= new Date(form.startAt).getTime()) {
    errors.time = '结束时间必须晚于开始时间'
    ok = false
  }
  if (!ok) return

  submitting.value = true
  try {
    await $fetch('/api/alert/silences', {
      method: 'POST',
      body: {
        systemId: form.scope === 'global' ? null : props.systemId,
        metricId: form.scope === 'metric' ? form.metricId : null,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        reason: form.reason.trim(),
      },
    })
    toast.success('静默窗口已创建')
    emit('saved')
    emit('update:visible', false)
  } catch (err) {
    toast.error(errorMessage(err, '创建失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container_silenceFormModal_form {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.container_silenceFormModal_grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: $space-3 $space-4;
}

.container_silenceFormModal_quick {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-wrap: wrap;
}

.container_silenceFormModal_quickLabel {
  font-size: $font-xs;
  color: $color-text-secondary;
}

.container_silenceFormModal_time {
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

.container_silenceFormModal_error {
  margin: -$space-2 0 0;
  color: $color-danger;
  font-size: $font-xs;
}
</style>
