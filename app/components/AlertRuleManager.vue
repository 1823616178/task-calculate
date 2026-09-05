<template>
  <div class="container_alertRuleManager">
    <div class="container_alertRuleManager_head">
      <p class="container_alertRuleManager_desc">指标触发预警 / 告警时，通过指定渠道发送通知</p>
      <UiButton
        variant="primary"
        size="sm"
        :disabled="channels.length === 0"
        :title="channels.length === 0 ? '请先创建通知渠道' : ''"
        @click="createVisible = true"
      >+ 新建规则</UiButton>
    </div>

    <!-- 无渠道提示升级为 UiEmpty + 直达新建渠道 -->
    <UiEmpty
      v-if="!loading && channels.length === 0 && rules.length >= 0"
      text="尚未配置通知渠道"
      description="告警通知需要先创建可用的通知渠道"
    >
      <NuxtLink to="/channels">
        <UiButton variant="primary">前往创建渠道</UiButton>
      </NuxtLink>
    </UiEmpty>

    <template v-else>
      <UiTable
        :columns="columns"
        :rows="rules"
        row-key="id"
        :loading="loading"
        empty-text="暂无告警规则"
        skeleton-rows="3"
      >
        <template #cell_metric="{ row }">{{ row.metric?.name || row.metricId }}</template>
        <template #cell_channel="{ row }">{{ row.channel?.name || row.channelId }}</template>
        <template #cell_notify="{ row }">
          <span class="container_alertRuleManager_notify">
            <UiBadge v-if="row.notifyWarning" variant="warning" size="sm">预警</UiBadge>
            <UiBadge v-if="row.notifyAlarm" variant="alarm" size="sm">告警</UiBadge>
            <span v-if="!row.notifyWarning && !row.notifyAlarm" class="container_alertRuleManager_none">未设置</span>
          </span>
        </template>
        <template #cell_cooldownSeconds="{ row }">
          {{ row.cooldownSeconds }}
        </template>
        <template #cell_enabled="{ row }">
          <UiSwitch
            :model-value="Boolean(row.enabled)"
            :aria-label="`规则启停（${row.metric?.name ?? ''} → ${row.channel?.name ?? ''}）`"
            @update:model-value="(v) => toggle(row, v)"
          />
        </template>
        <template #cell_actions="{ row }">
          <UiButton
            variant="link"
            size="sm"
            class="container_alertRuleManager_dangerLink"
            @click="remove(row)"
          >删除</UiButton>
        </template>
      </UiTable>
    </template>

    <AlertRuleFormModal
      v-model:visible="createVisible"
      :system-id="systemId"
      :metrics="metrics"
      @saved="() => void load()"
    />
  </div>
</template>

<script setup lang="ts">
import type { AlertChannelDto, AlertRuleDto, MetricDto } from '../types'
import type { UiColumn } from '../components/ui/UiTable.vue'

const props = defineProps<{ systemId: number, metrics: MetricDto[] }>()

const toast = useToast()

const rules = ref<AlertRuleDto[]>([])
const channels = ref<AlertChannelDto[]>([])
const loading = ref(false)
const createVisible = ref(false)

const columns: UiColumn[] = [
  { key: 'metric', label: '指标', width: '160px' },
  { key: 'channel', label: '通知渠道', width: '160px' },
  { key: 'notify', label: '通知级别' },
  { key: 'cooldownSeconds', label: '冷却（秒）', width: '100px', numeric: true },
  { key: 'enabled', label: '启用', width: '64px' },
  { key: 'actions', label: '操作', width: '80px' },
]

async function load() {
  loading.value = true
  try {
    const [rulesRes, channelsRes] = await Promise.all([
      $fetch<{ rules: AlertRuleDto[] }>('/api/alert/rules', { query: { systemId: props.systemId } }),
      $fetch<{ channels: AlertChannelDto[] }>('/api/alert/channels'),
    ])
    rules.value = rulesRes.rules
    channels.value = channelsRes.channels
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

async function toggle(r: AlertRuleDto, enabled: boolean) {
  try {
    await $fetch(`/api/alert/rules/${r.id}`, { method: 'PUT', body: { enabled } })
    r.enabled = enabled
    toast.info(`规则已${enabled ? '启用' : '停用'}`)
  } catch (err) {
    toast.error(errorMessage(err, '操作失败'))
  }
}

async function remove(r: AlertRuleDto) {
  const ok = await useConfirm().ask({
    title: '删除告警规则？',
    message: `${r.metric?.name ?? ''} → ${r.channel?.name ?? ''} 的规则将不再发送通知。`,
    danger: true,
    confirmText: '删除',
  })
  if (!ok) return
  try {
    await $fetch(`/api/alert/rules/${r.id}`, { method: 'DELETE' })
    await load()
    toast.success('规则已删除')
  } catch (err) {
    toast.error(errorMessage(err, '删除失败'))
  }
}
</script>

<style lang="scss" scoped>
.container_alertRuleManager_head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-3;
}

.container_alertRuleManager_desc {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_alertRuleManager_notify {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
}

.container_alertRuleManager_none {
  color: $color-text-secondary;
  font-size: $font-xs;
}

.container_alertRuleManager_dangerLink {
  color: $color-danger !important;
}
</style>
