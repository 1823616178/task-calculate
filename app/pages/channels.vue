<template>
  <div class="container_channels">
    <div class="container_channels_pageHead">
      <h1 class="container_channels_title">通知渠道</h1>
      <UiButton variant="primary" @click="openCreate">+ 新建渠道</UiButton>
    </div>

    <UiTable
      :columns="columns"
      :rows="channels"
      row-key="id"
      :loading="loading"
      empty-text="暂无通知渠道"
      skeleton-rows="4"
    >
      <template #empty>
        <UiEmpty text="暂无通知渠道" description="创建渠道后才能接收预警 / 告警通知">
          <UiButton variant="primary" @click="openCreate">+ 新建渠道</UiButton>
        </UiEmpty>
      </template>

      <template #cell_type="{ row }">
        <span
          class="container_channels_type"
          :class="`container_channels_type_${row.type}`"
        >
          <span class="container_channels_typeGlyph" aria-hidden="true">{{ typeGlyph(row.type) }}</span>
          {{ TYPE_LABELS[row.type as AlertChannelType] ?? row.type }}
        </span>
      </template>

      <template #cell_target="{ row }">
        <div class="container_channels_targetCell" :title="row.target">
          <UiCopy :text="String(row.target)" />
        </div>
      </template>

      <template #cell_enabled="{ row }">
        <UiSwitch
          :model-value="Boolean(row.enabled)"
          :aria-label="`${row.name} 启用开关`"
          @update:model-value="(v) => toggle(row, v)"
        />
      </template>

      <template #cell_createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>

      <template #cell_actions="{ row }">
        <div class="container_channels_actions">
          <UiButton variant="link" size="sm" @click="openEdit(row)">编辑</UiButton>
          <UiButton
            variant="link"
            size="sm"
            :loading="testingId === row.id"
            @click="test(row)"
          >测试</UiButton>
          <UiButton
            variant="link"
            size="sm"
            class="container_channels_dangerLink"
            @click="remove(row)"
          >删除</UiButton>
        </div>
      </template>
    </UiTable>

    <ChannelFormModal
      v-model:visible="formVisible"
      :mode="editTarget ? 'edit' : 'create'"
      :channel="editTarget"
      @saved="() => void load()"
    />
  </div>
</template>

<script setup lang="ts">
import type { AlertChannelDto } from '../types'
import type { AlertChannelType } from '../../shared/types'
import type { UiColumn } from '../components/ui/UiTable.vue'

const auth = useAuthStore()
const toast = useToast()

definePageMeta({ middleware: 'admin' })

const channels = ref<AlertChannelDto[]>([])
const loading = ref(false)
const testingId = ref<number | null>(null)
const formVisible = ref(false)
const editTarget = ref<AlertChannelDto | null>(null)

const TYPE_LABELS: Record<AlertChannelType, string> = {
  webhook: 'Webhook',
  dingtalk: '钉钉',
  wecom: '企业微信',
  email: '邮件',
}

function typeGlyph(t: string): string {
  return { webhook: '⇋', dingtalk: '◆', wecom: '◇', email: '@' }[t] ?? ''
}

const columns: UiColumn[] = [
  { key: 'type', label: '类型', width: '130px' },
  { key: 'name', label: '名称', width: '160px' },
  { key: 'target', label: '目标' },
  { key: 'enabled', label: '启用', width: '72px' },
  { key: 'createdAt', label: '创建时间', width: '170px' },
  { key: 'actions', label: '操作', width: '150px' },
]

onMounted(() => {
  void load()
})

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ channels: AlertChannelDto[] }>('/api/alert/channels')
    channels.value = res.channels
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editTarget.value = null
  formVisible.value = true
}

function openEdit(c: AlertChannelDto) {
  editTarget.value = c
  formVisible.value = true
}

async function test(c: AlertChannelDto) {
  testingId.value = c.id
  try {
    await $fetch(`/api/alert/channels/${c.id}/test`, { method: 'POST' })
    toast.success(`测试消息已发送到「${c.name}」，请检查是否收到。`)
  } catch (err) {
    toast.error(errorMessage(err, '测试发送失败'))
  } finally {
    testingId.value = null
  }
}

async function toggle(c: AlertChannelDto, enabled: boolean) {
  try {
    await $fetch(`/api/alert/channels/${c.id}`, { method: 'PUT', body: { enabled } })
    c.enabled = enabled
    toast.info(`已${enabled ? '启用' : '禁用'}「${c.name}」`)
  } catch (err) {
    toast.error(errorMessage(err, '操作失败'))
  }
}

async function remove(c: AlertChannelDto) {
  const ok = await useConfirm().ask({
    title: `删除渠道「${c.name}」？`,
    message: '关联的告警规则将一并删除。',
    danger: true,
    confirmText: '删除',
  })
  if (!ok) return
  try {
    await $fetch(`/api/alert/channels/${c.id}`, { method: 'DELETE' })
    await load()
    toast.success(`渠道「${c.name}」已删除`)
  } catch (err) {
    toast.error(errorMessage(err, '删除失败'))
  }
}
</script>

<style lang="scss" scoped>
.container_channels {
  max-width: 1200px;
  margin: 0 auto;
  padding: $space-5 $space-4 $space-6;
}

.container_channels_pageHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-4;
}

.container_channels_title {
  margin: 0;
  font-size: $font-xl;
}

.container_channels_type {
  display: inline-flex;
  align-items: center;
  gap: $space-2;

  &_webhook .container_channels_typeGlyph { color: $color-none; }
  &_dingtalk .container_channels_typeGlyph { color: var(--tc-primary); }
  &_wecom .container_channels_typeGlyph { color: $color-normal; }
  &_email .container_channels_typeGlyph { color: var(--tc-warning); }
}

.container_channels_typeGlyph {
  font-weight: 700;
}

.container_channels_targetCell {
  max-width: 420px;
  min-width: 200px;
}

.container_channels_actions {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  white-space: nowrap;
}

.container_channels_dangerLink {
  color: $color-danger !important;
}
</style>
