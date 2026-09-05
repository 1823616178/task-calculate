<template>
  <div class="container_apiKeyManager">
    <div class="container_apiKeyManager_head">
      <p class="container_apiKeyManager_desc">
        提交方（HTTP / MQTT / WS）使用 ApiKey 认证上报数据
      </p>
      <UiButton variant="primary" size="sm" @click="formVisible = true">+ 新建 ApiKey</UiButton>
    </div>

    <UiTable
      :columns="columns"
      :rows="apiKeys"
      row-key="id"
      :loading="loading"
      empty-text="暂无 ApiKey"
      skeleton-rows="3"
    >
      <template #cell_maskedKey="{ row }">
        <code>{{ row.maskedKey }}</code>
      </template>

      <template #cell_enabled="{ row }">
        <UiSwitch
          :model-value="Boolean(row.enabled)"
          :aria-label="`ApiKey 启停（${row.name}）`"
          @update:model-value="(v) => toggle(row, v)"
        />
      </template>

      <template #cell_lastUsedAt="{ row }">{{ formatDate(row.lastUsedAt) }}</template>
      <template #cell_createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>

      <template #cell_actions="{ row }">
        <div class="container_apiKeyManager_actions">
          <UiButton variant="link" size="sm" @click="rotate(row)">轮换</UiButton>
          <UiButton
            variant="link"
            size="sm"
            class="container_apiKeyManager_dangerLink"
            @click="remove(row)"
          >删除</UiButton>
        </div>
      </template>
    </UiTable>

    <ApiKeyFormModal
      v-model:visible="formVisible"
      :system-id="systemId"
      :rotate-key="rotateKey"
      @created="rotateKey = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiKeyDto } from '../types'
import type { UiColumn } from '../components/ui/UiTable.vue'

const props = defineProps<{ systemId: number }>()

const toast = useToast()

const apiKeys = ref<ApiKeyDto[]>([])
const loading = ref(false)
const formVisible = ref(false)
const rotateKey = ref<string | null>(null)

const columns: UiColumn[] = [
  { key: 'name', label: '名称', width: '170px' },
  { key: 'maskedKey', label: 'Key（脱敏）', width: '200px' },
  { key: 'enabled', label: '启用', width: '64px' },
  { key: 'lastUsedAt', label: '最近使用', width: '160px' },
  { key: 'createdAt', label: '创建时间', width: '160px' },
  { key: 'actions', label: '操作', width: '100px' },
]

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ apiKeys: ApiKeyDto[] }>('/api/api-keys', { query: { systemId: props.systemId } })
    apiKeys.value = res.apiKeys
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

async function toggle(k: ApiKeyDto, enabled: boolean) {
  try {
    await $fetch(`/api/api-keys/${k.id}`, { method: 'PUT', body: { enabled } })
    k.enabled = enabled
    toast.info(`已${enabled ? '启用' : '禁用'}「${k.name}」`)
  } catch (err) {
    toast.error(errorMessage(err, '操作失败'))
  }
}

async function rotate(k: ApiKeyDto) {
  const ok = await useConfirm().ask({
    title: `轮换「${k.name}」？`,
    message: '将生成新 Key，旧 Key 立即失效，使用方需更新配置。',
    confirmText: '轮换',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await $fetch<{ apiKey: { key: string } }>(`/api/api-keys/${k.id}/rotate`, { method: 'POST' })
    rotateKey.value = res.apiKey.key
    formVisible.value = true
    await load()
  } catch (err) {
    toast.error(errorMessage(err, '轮换失败'))
  }
}

async function remove(k: ApiKeyDto) {
  const ok = await useConfirm().ask({
    title: `删除 ApiKey「${k.name}」？`,
    message: '使用该 Key 的提交方将立即无法上报。',
    danger: true,
    confirmText: '删除',
  })
  if (!ok) return
  try {
    await $fetch(`/api/api-keys/${k.id}`, { method: 'DELETE' })
    await load()
    toast.success(`「${k.name}」已删除`)
  } catch (err) {
    toast.error(errorMessage(err, '删除失败'))
  }
}
</script>

<style lang="scss" scoped>
.container_apiKeyManager_head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-3;
}

.container_apiKeyManager_desc {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_apiKeyManager_actions {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  white-space: nowrap;
}

.container_apiKeyManager_dangerLink {
  color: $color-danger !important;
}
</style>
