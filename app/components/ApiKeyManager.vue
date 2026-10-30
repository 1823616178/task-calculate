<template>
  <div class="container_apiKeyManager">
    <div class="container_apiKeyManager_head">
      <p class="container_apiKeyManager_desc">
        所有 ApiKey 在这里统一管理；每个 Key 独立配置功能权限和可访问系统
      </p>
      <UiButton variant="primary" size="sm" @click="openCreate">+ 新建 ApiKey</UiButton>
    </div>

    <UiTable
      :columns="columns"
      :rows="apiKeys"
      row-key="id"
      :loading="loading"
      empty-text="暂无 ApiKey"
      skeleton-rows="3"
      :row-class="(row) => (row.enabled ? '' : 'container_apiKeyManager_rowDisabled')"
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

      <template #cell_scope="{ row }">
        <UiBadge v-if="row.allSystems" variant="primary" size="sm">全部系统</UiBadge>
        <div v-else-if="row.systemIds.length > 0" class="container_apiKeyManager_tags">
          <UiTag v-for="systemId in row.systemIds" :key="systemId">{{ systemLabel(systemId) }}</UiTag>
        </div>
        <span v-else class="container_apiKeyManager_emptyScope">无可访问系统</span>
      </template>

      <template #cell_permissions="{ row }">
        <div class="container_apiKeyManager_tags">
          <UiTag v-for="permission in row.permissions" :key="permission">{{ permission }}</UiTag>
        </div>
      </template>

      <template #cell_lastUsedAt="{ row }">{{ formatDate(row.lastUsedAt) }}</template>
      <template #cell_createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>

      <template #cell_actions="{ row }">
        <div class="container_apiKeyManager_actions">
          <UiButton variant="link" size="sm" @click="edit(row)">权限</UiButton>
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
      :rotate-key="rotateKey"
      :edit-key="editTarget"
      @created="load"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiKeyDto } from '../types'
import type { UiColumn } from '../components/ui/UiTable.vue'

const toast = useToast()
const dashboard = useDashboardStore()

const apiKeys = ref<ApiKeyDto[]>([])
const loading = ref(false)
const formVisible = ref(false)
const rotateKey = ref<string | null>(null)
const editTarget = ref<ApiKeyDto | null>(null)

const columns: UiColumn[] = [
  { key: 'name', label: '名称', width: '150px' },
  { key: 'maskedKey', label: 'Key（脱敏）', width: '160px' },
  { key: 'scope', label: '系统范围', width: '220px' },
  { key: 'permissions', label: '功能权限', width: '300px' },
  { key: 'enabled', label: '启用', width: '64px' },
  { key: 'lastUsedAt', label: '最近使用', width: '160px' },
  { key: 'createdAt', label: '创建时间', width: '160px' },
  { key: 'actions', label: '操作', width: '100px' },
]

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ apiKeys: ApiKeyDto[] }>('/api/api-keys')
    apiKeys.value = res.apiKeys
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void dashboard.ensure()
  void load()
})

// 弹窗关闭后清掉轮换结果，下次"新建"才会回到填写步骤
watch(formVisible, (v) => {
  if (!v) {
    rotateKey.value = null
    editTarget.value = null
  }
})

function edit(k: ApiKeyDto) {
  editTarget.value = k
  formVisible.value = true
}

function openCreate() {
  rotateKey.value = null
  editTarget.value = null
  formVisible.value = true
}

function systemLabel(systemId: number): string {
  const system = dashboard.systems.find(item => item.id === systemId)
  return system ? `${system.name}（${system.code}）` : `系统 #${systemId}`
}

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
    message: '将生成新 Key，旧 Key 立即失效，上报与查询使用方都需更新配置。',
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
    message: '使用该 Key 的调用方将无法继续上报或发起新的查询。',
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

.container_apiKeyManager_tags {
  display: flex;
  flex-wrap: wrap;
  gap: $space-1;
}

.container_apiKeyManager_emptyScope {
  color: $color-text-secondary;
}

.container_apiKeyManager_dangerLink {
  color: $color-danger !important;
}
</style>

<style lang="scss">
.container_apiKeyManager_rowDisabled > td {
  opacity: 0.55;
}
</style>
