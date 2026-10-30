<template>
  <div class="container_audit">
    <UiPageHead title="审计日志" description="管理员对用户、系统、指标与告警配置的变更记录" />

    <UiCard class="container_audit_filterCard">
      <div class="container_audit_filterBar">
        <UiField label="操作者">
          <UiInput v-model.trim="filters.username" placeholder="用户名" size="md" />
        </UiField>

        <UiField label="动作">
          <UiSelect v-model="actionPreset">
            <option value="">全部动作</option>
            <option v-for="(label, prefix) in ACTION_PRESETS" :key="prefix" :value="prefix">
              {{ label }}（{{ prefix }}）
            </option>
            <option value="__custom">自定义前缀…</option>
          </UiSelect>
        </UiField>

        <UiField v-if="actionPreset === '__custom'" label="动作前缀">
          <UiInput v-model.trim="filters.action" placeholder="如 user." />
        </UiField>

        <template v-if="showTimeRange">
          <UiField label="开始时间">
            <input
              v-model="filters.from"
              type="datetime-local"
              class="container_audit_time"
            >
          </UiField>
          <UiField label="结束时间">
            <input
              v-model="filters.to"
              type="datetime-local"
              class="container_audit_time"
            >
          </UiField>
        </template>

        <div class="container_audit_filterActions">
          <UiButton variant="ghost" size="sm" @click="showTimeRange = !showTimeRange">
            {{ showTimeRange ? '收起时间' : '按时间' }}
          </UiButton>
          <UiButton variant="secondary" @click="resetFilters">重置</UiButton>
          <UiButton variant="primary" @click="search">查询</UiButton>
        </div>
      </div>
    </UiCard>

    <UiTable
      :columns="columns"
      :rows="logs"
      row-key="id"
      :loading="loading"
      empty-text="暂无日志"
      skeleton-rows="8"
    >
      <template #cell_action="{ row }">
        <code>{{ row.action }}</code>
      </template>

      <template #cell_detail="{ row }">
        <button
          type="button"
          class="container_audit_detailBtn"
          @click="openDetail(row)"
        >{{ row.detail ? '查看' : '—' }}</button>
      </template>
    </UiTable>

    <UiPagination
      v-model:page="page"
      :total-pages="totalPages"
      :total="total"
      :page-size="pageSize"
      :page-sizes="[20, 50, 100]"
      @update:page-size="onPageSize"
    />

    <AuditDetailModal
      v-model:visible="detailVisible"
      :log="detailTarget"
    />
  </div>
</template>

<script setup lang="ts">

useHead({ title: '审计日志' })
import type { UiColumn } from '../components/ui/UiTable.vue'

interface AuditLogDto {
  id: string
  username: string
  action: string
  target: string
  detail: string | null
  createdAt: string
}

definePageMeta({ middleware: 'admin' })

const ACTION_PRESETS: Record<string, string> = {
  'user.': '用户',
  'system.': '系统',
  'metric.': '指标',
  'channel.': '渠道',
  'alert.': '告警',
}

const filters = reactive({
  username: '',
  action: '',
  from: '',
  to: '',
})
const actionPreset = ref('')
const showTimeRange = ref(false)

watch(actionPreset, (p) => {
  filters.action = p === '__custom' ? '' : p
})

const logs = ref<AuditLogDto[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loading = ref(false)

const detailVisible = ref(false)
const detailTarget = ref<AuditLogDto | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const columns: UiColumn[] = [
  { key: 'createdAt', label: '时间', width: '170px' },
  { key: 'username', label: '操作者', width: '120px' },
  { key: 'action', label: '动作', width: '160px' },
  { key: 'target', label: '目标' },
  { key: 'detail', label: '详情' },
]

onMounted(() => {
  void load()
})

function openDetail(log: AuditLogDto) {
  detailTarget.value = log
  detailVisible.value = true
}

async function load() {
  loading.value = true
  try {
    const query: Record<string, string | number> = { page: page.value, pageSize: pageSize.value }
    if (filters.username) query.username = filters.username
    if (filters.action) query.action = filters.action
    if (filters.from) query.from = new Date(filters.from).toISOString()
    if (filters.to) query.to = new Date(filters.to).toISOString()
    const res = await $fetch<{ list: AuditLogDto[], total: number }>('/api/audit', { query })
    logs.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

// 详情列由 openDetail 打开弹窗展示完整内容
function search() {
  page.value = 1
  void load()
}

function resetFilters() {
  Object.assign(filters, { username: '', action: '', from: '', to: '' })
  actionPreset.value = ''
  search()
}

async function onPageSize(size: number) {
  pageSize.value = size
  page.value = 1
  await load()
}
</script>

<style lang="scss" scoped>
.container_audit {
  max-width: 1200px;
  margin: 0 auto;
  padding: $space-5 $space-4 $space-6;
}

.container_audit_filterCard {
  margin-bottom: $space-4;
  animation: tc-rise $dur-slow $ease-out 60ms both;
}

.container_audit_filterBar {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: $space-3 $space-4;
  align-items: end;
}

.container_audit_time {
  width: 100%;
  height: $control-md;
  padding: 0 $space-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  background: var(--tc-card-bg);
  color: inherit;
  font-size: $font-base;
  outline: none;
  transition: border-color $dur-fast $ease-out, box-shadow $dur-fast $ease-out;

  &:hover {
    border-color: $color-text-secondary;
  }

  &:focus-visible {
    outline: none;
    border-color: $color-primary;
    box-shadow: 0 0 0 2px var(--tc-focus-ring);
  }
}

.container_audit_filterActions {
  display: flex;
  align-items: center;
  gap: $space-2;
  justify-content: flex-end;
  grid-column: -2 / -1;
}

.container_audit_detailBtn {
  display: block;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0;
  border: none;
  background: none;
  color: $color-text-secondary;
  font-size: $font-sm;
  text-align: left;
  cursor: pointer;

  &:hover {
    color: $color-primary;
    text-decoration: underline;
  }
}
</style>
