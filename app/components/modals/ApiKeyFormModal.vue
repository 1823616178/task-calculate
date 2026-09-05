<template>
  <UiModal
    :model-value="visible"
    size="sm"
    :title="title"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <!-- 第一步：填写名称 -->
    <div v-if="phase === 'form'" class="container_apiKeyFormModal_form">
      <UiField label="Key 名称" required hint="便于识别提交来源，如：产线网关">
        <UiInput
          v-model="name"
          data-autofocus
          placeholder="如：产线网关"
          :invalid="!!error"
          @enter.prevent="submit"
        />
      </UiField>
      <p v-if="error" class="container_apiKeyFormModal_error" role="alert">{{ error }}</p>
    </div>

    <!-- 第二步：展示新 Key（仅一次） -->
    <div v-else class="container_apiKeyFormModal_reveal">
      <p class="container_apiKeyFormModal_warn">
        请立即保存，该 Key <strong>仅显示这一次</strong>：
      </p>
      <div class="container_apiKeyFormModal_key">
        <code>{{ newKey }}</code>
        <UiCopy :text="newKey" />
      </div>
      <label class="container_apiKeyFormModal_ack">
        <input v-model="acknowledged" type="checkbox">
        我已妥善保存此 Key
      </label>
    </div>

    <template #footer>
      <template v-if="phase === 'form'">
        <UiButton variant="secondary" @click="emit('update:visible', false)">取消</UiButton>
        <UiButton variant="primary" :loading="submitting" @click="submit">生成</UiButton>
      </template>
      <template v-else>
        <UiButton variant="primary" :disabled="!acknowledged" @click="done">
          完成并关闭
        </UiButton>
      </template>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
// 新建 ApiKey 弹窗：创建成功后进入"仅显示一次"步骤，
// 等宽字体展示 + 一键复制 + 勾选确认后才能关闭。
// 也用于展示轮换结果：传 rotateKey 时直接进入展示步骤。
const props = defineProps<{
  visible: boolean
  systemId: number
  /** 轮换返回的新 Key，直接以"仅显示一次"步骤打开 */
  rotateKey?: string | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  created: []
}>()

const toast = useToast()

const phase = ref<'form' | 'reveal'>('form')
const name = ref('')
const newKey = ref('')
const acknowledged = ref(false)
const error = ref('')
const submitting = ref(false)

const title = computed(() => (phase.value === 'form' ? '新建 ApiKey' : 'ApiKey 已生成'))

watch(() => props.visible, (v) => {
  if (!v) return
  error.value = ''
  acknowledged.value = false
  if (props.rotateKey) {
    newKey.value = props.rotateKey
    name.value = ''
    phase.value = 'reveal'
    return
  }
  newKey.value = ''
  name.value = ''
  phase.value = 'form'
})

function done() {
  emit('created')
  emit('update:visible', false)
}

async function submit() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = '请填写 Key 名称'
    return
  }
  submitting.value = true
  try {
    const res = await $fetch<{ apiKey: { key: string } }>('/api/api-keys', {
      method: 'POST',
      body: { systemId: props.systemId, name: name.value.trim() },
    })
    newKey.value = res.apiKey.key
    phase.value = 'reveal'
    toast.success(`ApiKey「${name.value.trim()}」已创建`)
  } catch (err) {
    error.value = errorMessage(err, '创建失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container_apiKeyFormModal_form {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.container_apiKeyFormModal_error {
  margin: -6px 0 0;
  color: $color-danger;
  font-size: $font-xs;
}

.container_apiKeyFormModal_reveal {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.container_apiKeyFormModal_warn {
  margin: 0;
  font-size: $font-sm;

  strong {
    color: $color-warning;
  }
}

.container_apiKeyFormModal_key {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  padding: $space-2 $space-3;
  border-radius: $radius-md;
  background: var(--tc-code-bg);
  border: 1px dashed $color-border;

  code {
    background: none;
    padding: 0;
    word-break: break-all;
    line-height: 1.5;
  }
}

.container_apiKeyFormModal_ack {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-size: $font-sm;
  cursor: pointer;

  input {
    width: 15px;
    height: 15px;
    accent-color: var(--tc-primary);
  }
}
</style>
