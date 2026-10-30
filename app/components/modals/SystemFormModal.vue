<template>
  <UiModal
    :model-value="visible"
    size="md"
    :title="mode === 'create' ? '新建系统' : '编辑系统'"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div class="container_systemFormModal_form">
      <UiField label="系统编码" required hint="仅字母、数字、下划线与连字符，创建后不可修改">
        <UiInput
          v-model="form.code"
          data-autofocus
          placeholder="如：line1"
          :invalid="!!errors.code"
          :disabled="mode === 'edit'"
        />
      </UiField>
      <p v-if="errors.code" class="container_systemFormModal_error" role="alert">{{ errors.code }}</p>

      <UiField label="系统名称" required>
        <UiInput
          v-model="form.name"
          placeholder="如：产线一号"
          :invalid="!!errors.name"
          @enter.prevent="submit"
        />
      </UiField>
      <p v-if="errors.name" class="container_systemFormModal_error" role="alert">{{ errors.name }}</p>

      <UiField label="描述">
        <UiTextarea v-model="form.description" placeholder="可选，用于说明系统用途" :rows="3" />
      </UiField>

      <UiField
        v-if="mode === 'edit'"
        label="记录保留天数"
        hint="留空跟随全局策略；0 表示永久保留"
      >
        <UiNumber v-model="form.retentionDays" unit="天" placeholder="全局默认" />
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
import type { SystemDto } from '../../types'

// 新建/编辑系统弹窗
const props = defineProps<{
  visible: boolean
  mode: 'create' | 'edit'
  system?: SystemDto | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: []
}>()

const toast = useToast()
const dashboard = useDashboardStore()

// 与服务端 systemInputSchema 保持一致
const CODE_RE = /^[\w-]+$/

const form = reactive({ code: '', name: '', description: '', retentionDays: '' })
const errors = reactive<{ code?: string, name?: string }>({})
const submitting = ref(false)

watch(() => props.visible, (v) => {
  if (!v) return
  errors.code = undefined
  errors.name = undefined
  if (props.mode === 'edit' && props.system) {
    form.code = props.system.code
    form.name = props.system.name
    form.description = props.system.description ?? ''
    form.retentionDays = props.system.retentionDays === null || props.system.retentionDays === undefined
      ? ''
      : String(props.system.retentionDays)
  } else {
    Object.assign(form, { code: '', name: '', description: '', retentionDays: '' })
  }
})

function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

async function submit() {
  errors.code = ''
  errors.name = ''
  let ok = true
  if (props.mode === 'create' && !CODE_RE.test(form.code.trim())) {
    errors.code = '编码只能包含字母、数字、下划线与连字符'
    ok = false
  }
  if (!form.name.trim()) {
    errors.name = '请填写系统名称'
    ok = false
  }
  if (!ok) return

  submitting.value = true
  try {
    if (props.mode === 'create') {
      await $fetch('/api/systems', {
        method: 'POST',
        body: {
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        },
      })
      toast.success('系统已创建')
    } else if (props.system) {
      await $fetch(`/api/systems/${props.system.id}`, {
        method: 'PUT',
        body: {
          name: form.name.trim(),
          description: form.description.trim(),
          retentionDays: numOrNull(form.retentionDays),
        },
      })
      toast.success('系统信息已保存')
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
.container_systemFormModal_form {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.container_systemFormModal_error {
  margin: -6px 0 0;
  color: $color-danger;
  font-size: $font-xs;
}
</style>
