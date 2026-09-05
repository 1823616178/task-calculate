<template>
  <UiModal
    :model-value="visible"
    size="md"
    title="新建告警规则"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div class="container_alertRuleFormModal_form">
      <UiField label="指标" required>
        <UiSelect v-model="form.metricId" data-autofocus>
          <option value="" disabled>选择指标</option>
          <option v-for="m in metrics" :key="m.id" :value="m.id">
            {{ m.name }}（{{ m.code }}）
          </option>
        </UiSelect>
      </UiField>

      <UiField label="通知渠道" required hint="仅启用的渠道可用">
        <UiSelect v-model="form.channelId">
          <option value="" disabled>选择通知渠道</option>
          <option v-for="c in enabledChannels" :key="c.id" :value="c.id">
            {{ c.name }}（{{ typeLabel(c.type) }}）
          </option>
        </UiSelect>
      </UiField>

      <fieldset class="container_alertRuleFormModal_notify">
        <legend>通知级别</legend>
        <label class="container_alertRuleFormModal_check">
          <input v-model="form.notifyWarning" type="checkbox"> 预警时通知
        </label>
        <label class="container_alertRuleFormModal_check">
          <input v-model="form.notifyAlarm" type="checkbox"> 告警时通知
        </label>
      </fieldset>

      <UiField
        label="冷却时间（秒）"
        hint="同一规则在冷却期内不会重复发送"
      >
        <UiNumber v-model.number="cooldownDisplay" unit="秒" placeholder="300" />
      </UiField>

      <p v-if="error" class="container_alertRuleFormModal_error" role="alert">{{ error }}</p>
    </div>

    <template #footer>
      <UiButton variant="secondary" @click="emit('update:visible', false)">取消</UiButton>
      <UiButton variant="primary" :loading="submitting" @click="submit">创建</UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import type { AlertChannelDto, MetricDto } from '../../types'
import type { AlertChannelType } from '../../../shared/types'

// 新建告警规则弹窗：指标 / 渠道 / 通知级别 / 冷却
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

const TYPE_LABELS: Record<AlertChannelType, string> = {
  webhook: 'Webhook',
  dingtalk: '钉钉',
  wecom: '企业微信',
  email: '邮件',
}

function typeLabel(t: AlertChannelType): string {
  return TYPE_LABELS[t] ?? t
}

const form = reactive({
  metricId: '' as '' | number,
  channelId: '' as '' | number,
  notifyWarning: true,
  notifyAlarm: true,
  cooldownSeconds: 300,
})
const error = ref('')
const submitting = ref(false)

const channels = ref<AlertChannelDto[]>([])
const enabledChannels = computed(() => channels.value.filter((c) => c.enabled))

// UiNumber 走字符串，这里桥接数值字段
const cooldownDisplay = ref('300')
watch(() => props.visible, (v) => {
  if (!v) return
  Object.assign(form, { metricId: '', channelId: '', notifyWarning: true, notifyAlarm: true })
  cooldownDisplay.value = '300'
  error.value = ''
  void load()
})

async function load() {
  try {
    const res = await $fetch<{ channels: AlertChannelDto[] }>('/api/alert/channels')
    channels.value = res.channels
  } catch (err) {
    error.value = errorMessage(err, '加载通知渠道失败')
  }
}

async function submit() {
  error.value = ''
  if (form.metricId === '') {
    error.value = '请选择指标'
    return
  }
  if (form.channelId === '') {
    error.value = '请选择通知渠道'
    return
  }
  const cooldown = Number(cooldownDisplay.value) || 0

  submitting.value = true
  try {
    await $fetch('/api/alert/rules', {
      method: 'POST',
      body: {
        metricId: form.metricId,
        channelId: form.channelId,
        notifyWarning: form.notifyWarning,
        notifyAlarm: form.notifyAlarm,
        cooldownSeconds: cooldown,
      },
    })
    toast.success('告警规则已创建')
    emit('saved')
    emit('update:visible', false)
  } catch (err) {
    error.value = errorMessage(err, '创建失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container_alertRuleFormModal_form {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.container_alertRuleFormModal_notify {
  display: flex;
  gap: $space-5;
  padding: $space-3 $space-4 $space-4;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  margin: 0;

  legend {
    padding: 0 $space-2;
    font-size: $font-sm;
    color: $color-text-secondary;
  }
}

.container_alertRuleFormModal_check {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-size: $font-base;
  cursor: pointer;

  input {
    accent-color: var(--tc-primary);
  }
}

.container_alertRuleFormModal_error {
  margin: 0;
  color: $color-danger;
  font-size: $font-xs;
}
</style>
