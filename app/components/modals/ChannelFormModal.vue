<template>
  <UiModal
    :model-value="visible"
    size="md"
    :title="mode === 'create' ? '新建通知渠道' : '编辑渠道'"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div class="container_channelFormModal_form">
      <div class="container_channelFormModal_grid">
        <UiField label="类型" required hint="创建后不可修改">
          <UiSelect
            v-model="form.type"
            data-autofocus
            :disabled="mode === 'edit'"
          >
            <option v-for="(label, t) in TYPE_LABELS" :key="t" :value="t">{{ typeGlyph(t) }} {{ label }}</option>
          </UiSelect>
        </UiField>

        <UiField label="渠道名称" required>
          <UiInput v-model="form.name" placeholder="如：值班群机器人" :invalid="!!errors.name" />
        </UiField>
      </div>

      <UiField :label="targetLabel" required>
        <UiTextarea
          v-if="form.type === 'email'"
          v-model="form.target"
          placeholder="a@example.com, b@example.com"
          :rows="2"
        />
        <UiInput
          v-else
          v-model="form.target"
          :placeholder="TARGET_PLACEHOLDERS[form.type]"
          :invalid="!!errors.target"
        />
      </UiField>
      <p v-if="errors.target" class="container_channelFormModal_error" role="alert">{{ errors.target }}</p>

      <UiField
        v-if="form.type === 'dingtalk'"
        label="加签密钥"
        hint="钉钉机器人开启加签安全设置时填写（创建后无法查看）"
      >
        <UiInput v-model="form.secret" type="password" placeholder="SEC 开头的密钥，可选" />
      </UiField>
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
import type { AlertChannelDto } from '../../types'
import type { AlertChannelType } from '../../../shared/types'

// 新建/编辑渠道弹窗：按 type 动态渲染字段（dingtalk 显示加签密钥）
const props = defineProps<{
  visible: boolean
  mode: 'create' | 'edit'
  channel?: AlertChannelDto | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: []
}>()

const toast = useToast()

const TYPE_LABELS: Record<AlertChannelType, string> = {
  webhook: 'Webhook',
  dingtalk: '钉钉机器人',
  wecom: '企业微信机器人',
  email: '邮件',
}

const TARGET_PLACEHOLDERS: Record<AlertChannelType, string> = {
  webhook: '回调 URL（POST JSON）',
  dingtalk: '机器人 Webhook 地址',
  wecom: '机器人 Webhook 地址',
  email: '收件邮箱，多个用逗号分隔',
}

const TARGET_LABELS: Record<AlertChannelType, string> = {
  webhook: '回调地址',
  dingtalk: '机器人 Webhook 地址',
  wecom: '机器人 Webhook 地址',
  email: '收件邮箱',
}

function typeGlyph(t: AlertChannelType): string {
  return { webhook: '⇋', dingtalk: '◆', wecom: '◇', email: '@' }[t] ?? ''
}

const form = reactive({
  type: 'webhook' as AlertChannelType,
  name: '',
  target: '',
  secret: '',
})
const errors = reactive<{ name?: string, target?: string }>({})
const submitting = ref(false)

const targetLabel = computed(() => TARGET_LABELS[form.type])

watch(() => props.visible, (v) => {
  if (!v) return
  errors.name = undefined
  errors.target = undefined
  if (props.mode === 'edit' && props.channel) {
    const c = props.channel
    form.type = c.type
    form.name = c.name
    form.target = c.target
    form.secret = '' // 密钥后端不回显，留空表示不修改
  } else {
    Object.assign(form, { type: 'webhook', name: '', target: '', secret: '' })
  }
})

async function submit() {
  errors.name = ''
  errors.target = ''
  let ok = true
  if (!form.name.trim()) {
    errors.name = '请填写渠道名称'
    ok = false
  }
  if (!form.target.trim()) {
    errors.target = form.type === 'email' ? '请填写收件邮箱' : TARGET_PLACEHOLDERS[form.type]
    ok = false
  }
  if (!ok) return

  submitting.value = true
  try {
    if (props.mode === 'create') {
      await $fetch('/api/alert/channels', {
        method: 'POST',
        body: {
          type: form.type,
          name: form.name.trim(),
          target: form.target.trim(),
          secret: form.secret.trim() || null,
        },
      })
      toast.success('渠道已创建')
    } else if (props.channel) {
      await $fetch(`/api/alert/channels/${props.channel.id}`, {
        method: 'PUT',
        body: {
          name: form.name.trim(),
          target: form.target.trim(),
          ...(props.channel.type === 'dingtalk' && form.secret.trim() ? { secret: form.secret.trim() } : {}),
        },
      })
      toast.success('已保存')
    }
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
.container_channelFormModal_form {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.container_channelFormModal_grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: $space-3 $space-4;
}

.container_channelFormModal_error {
  margin: -8px 0 0;
  color: $color-danger;
  font-size: $font-xs;
}
</style>
