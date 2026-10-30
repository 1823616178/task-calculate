<template>
  <UiModal
    :model-value="visible"
    size="lg"
    :title="title"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <!-- 第一步：填写名称、系统范围与能力 -->
    <div v-if="phase === 'form'" class="container_apiKeyFormModal_form">
      <UiField label="Key 名称" required hint="便于识别调用方，如：产线网关、数据同步服务">
        <UiInput
          v-model="name"
          data-autofocus
          placeholder="如：产线网关"
          :invalid="!!error"
          @enter.prevent="submit"
        />
      </UiField>
      <UiField label="系统范围" required hint="勾选该 Key 可以读取、上报或管理的系统">
        <label v-if="canGrantAllSystems" class="container_apiKeyFormModal_check">
          <input v-model="allSystems" type="checkbox"> 全部系统（也包含以后新建的系统）
        </label>
        <div v-if="!allSystems" class="container_apiKeyFormModal_checks">
          <label v-for="system in dashboard.systems" :key="system.id" class="container_apiKeyFormModal_check">
            <input v-model="systemIds" type="checkbox" :value="system.id">
            {{ system.name }}（{{ system.code }}）
          </label>
        </div>
      </UiField>
      <UiField label="功能权限" required hint="按最小权限原则授权；登录控制台通常至少需要 data:read">
        <div class="container_apiKeyFormModal_checks">
          <label v-for="item in permissionOptions" :key="item.value" class="container_apiKeyFormModal_check">
            <input v-model="permissions" type="checkbox" :value="item.value">
            <span><code>{{ item.value }}</code> — {{ item.label }}</span>
          </label>
        </div>
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
        <UiButton variant="primary" :loading="submitting" @click="submit">{{ editKey ? '保存' : '生成' }}</UiButton>
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
import { API_PERMISSIONS } from '#shared/types'
import type { ApiPermission } from '#shared/types'
import type { ApiKeyDto } from '../../types'
// 新建 ApiKey 弹窗：创建成功后进入"仅显示一次"步骤，
// 等宽字体展示 + 一键复制 + 勾选确认后才能关闭。
// 也用于展示轮换结果：传 rotateKey 时直接进入展示步骤。
const props = defineProps<{
  visible: boolean
  /** 轮换返回的新 Key，直接以"仅显示一次"步骤打开 */
  rotateKey?: string | null
  editKey?: ApiKeyDto | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  created: []
}>()

const toast = useToast()
const auth = useAuthStore()
const dashboard = useDashboardStore()

const phase = ref<'form' | 'reveal'>('form')
const name = ref('')
const newKey = ref('')
const acknowledged = ref(false)
const error = ref('')
const submitting = ref(false)
const systemIds = ref<number[]>([])
const allSystems = ref(false)
const permissions = ref<ApiPermission[]>([])

const title = computed(() => (phase.value === 'reveal' ? 'ApiKey 已生成' : (props.editKey ? '编辑 ApiKey 权限' : '新建 ApiKey')))
const canGrantAllSystems = computed(() => auth.user?.allSystems === true)
const permissionLabels: Record<ApiPermission, string> = {
  'data:read': '读取数据、统计、导出与实时看板',
  'data:write': '通过 HTTP / WS / MQTT 上报数据',
  'systems:manage': '管理系统',
  'metrics:manage': '管理指标与阈值',
  'apiKeys:manage': '管理 ApiKey',
  'alerts:manage': '管理通知、规则与静默',
  'users:manage': '管理用户',
  'audit:read': '读取审计日志',
  'maintenance:run': '执行数据清理',
}
const permissionOptions = computed(() => API_PERMISSIONS
  .filter(permission => auth.can(permission))
  .map(value => ({ value, label: permissionLabels[value] })))

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
  name.value = props.editKey?.name ?? ''
  systemIds.value = [...(props.editKey?.systemIds ?? [])]
  allSystems.value = props.editKey?.allSystems ?? false
  permissions.value = [...(props.editKey?.permissions ?? (['data:read', 'data:write'] as ApiPermission[]).filter(permission => auth.can(permission)))]
  phase.value = 'form'
})

function done() {
  emit('update:visible', false)
}

async function submit() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = '请填写 Key 名称'
    return
  }
  if (!allSystems.value && systemIds.value.length === 0) {
    error.value = '请至少选择一个系统'
    return
  }
  if (permissions.value.length === 0) {
    error.value = '请至少选择一项功能权限'
    return
  }
  submitting.value = true
  try {
    const body = {
      name: name.value.trim(),
      systemIds: systemIds.value,
      allSystems: allSystems.value,
      permissions: permissions.value,
    }
    const url = props.editKey ? `/api/api-keys/${props.editKey.id}` : '/api/api-keys'
    const res = await $fetch<{ apiKey: { key?: string } }>(url, {
      method: props.editKey ? 'PUT' : 'POST',
      body,
    })
    emit('created')
    if (props.editKey) {
      toast.success(`ApiKey「${name.value.trim()}」权限已更新`)
      emit('update:visible', false)
    }
    else {
      newKey.value = res.apiKey.key ?? ''
      phase.value = 'reveal'
      toast.success(`ApiKey「${name.value.trim()}」已创建`)
    }
  } catch (err) {
    error.value = errorMessage(err, props.editKey ? '保存失败' : '创建失败')
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

.container_apiKeyFormModal_checks {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  max-height: 180px;
  overflow: auto;
  padding: $space-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.container_apiKeyFormModal_check {
  display: flex;
  align-items: flex-start;
  gap: $space-2;
  font-size: $font-sm;
  cursor: pointer;

  input {
    margin-top: 3px;
    accent-color: var(--tc-primary);
  }
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
