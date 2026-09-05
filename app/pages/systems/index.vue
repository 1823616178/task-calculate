<template>
  <div class="container_systems">
    <div class="container_systems_pageHead">
      <h1 class="container_systems_title">系统管理</h1>
      <UiButton
        v-if="auth.isAdmin"
        variant="primary"
        @click="openCreate"
      >+ 新建系统</UiButton>
    </div>

    <UiCard :flush="true">
      <template #actions>
        <div class="container_systems_search">
          <UiInput
            v-model="keyword"
            placeholder="搜索编码 / 名称…"
            size="sm"
            aria-label="搜索系统"
          />
        </div>
      </template>

      <UiTable
        :columns="columns"
        :rows="filteredSystems"
        row-key="id"
        :loading="dashboard.loading && dashboard.systems.length === 0"
        empty-text="暂无系统"
        skeleton-rows="6"
      >
        <template #empty>
          <UiEmpty text="暂无系统" description="新建第一个系统以开始接入指标数据">
            <UiButton
              v-if="auth.isAdmin"
              variant="primary"
              @click="openCreate"
            >+ 新建系统</UiButton>
          </UiEmpty>
        </template>

        <template #cell_code="{ row }">
          <code>{{ row.code }}</code>
        </template>

        <template #cell_name="{ row }">
          <NuxtLink :to="`/systems/${row.id}`" class="container_systems_nameLink">
            {{ row.name }}
          </NuxtLink>
        </template>

        <template #cell_summary="{ row }">
          <div class="container_systems_summaryBar" :title="`正常 ${row.summary.normal || 0} / 预警 ${row.summary.warning || 0} / 告警 ${row.summary.alarm || 0}`">
            <span
              class="container_systems_summarySeg container_systems_summarySeg_normal"
              :style="{ flexGrow: (row.summary.normal || 0) + 0.15 }"
            />
            <span
              class="container_systems_summarySeg container_systems_summarySeg_warning"
              :style="{ flexGrow: (row.summary.warning || 0) + 0.15 }"
            />
            <span
              class="container_systems_summarySeg container_systems_summarySeg_alarm"
              :style="{ flexGrow: (row.summary.alarm || 0) + 0.15 }"
            />
          </div>
        </template>

        <template #cell_createdAt="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>

        <template #cell_actions="{ row }">
          <div class="container_systems_actions">
            <NuxtLink
              :to="`/systems/${row.id}`"
              class="container_systems_actionLink"
            >详情</NuxtLink>
            <UiButton
              v-if="auth.isAdmin"
              variant="link"
              size="sm"
              class="container_systems_dangerLink"
              @click="onDelete(row)"
            >删除</UiButton>
          </div>
        </template>
      </UiTable>
    </UiCard>

    <SystemFormModal
      v-model:visible="createVisible"
      mode="create"
      @saved="() => void dashboard.fetch()"
    />
  </div>
</template>

<script setup lang="ts">
import type { SystemWithMetrics } from '../types'
import type { UiColumn } from '../components/ui/UiTable.vue'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const toast = useToast()

definePageMeta({ middleware: 'admin' })

const createVisible = ref(false)
const keyword = ref('')

const columns: UiColumn[] = [
  { key: 'code', label: '编码', width: '140px' },
  { key: 'name', label: '名称' },
  { key: 'descriptionText', label: '描述' },
  { key: 'metricCount', label: '指标数', width: '72px', numeric: true },
  { key: 'summary', label: '正常 / 预警 / 告警', width: '160px' },
  { key: 'createdAt', label: '创建时间', width: '170px' },
  { key: 'actions', label: '操作', width: '110px' },
]

// 行适配：把嵌套 summary 拍平为 UiTable 可直接渲染的列 + 搜索过滤（编码/名称）
const filteredSystems = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return dashboard.systems.map((sys) => ({
    ...sys,
    metricCount: sys.metrics.length,
    descriptionText: sys.description || '—',
  })).filter((sys) => !kw || sys.code.toLowerCase().includes(kw) || sys.name.toLowerCase().includes(kw))
})

function openCreate() {
  createVisible.value = true
}

async function onDelete(sys: SystemWithMetrics & { metricCount: number }) {
  // 级联删除全部历史记录 → 强确认：要求输入系统 code
  const ok = await useConfirm().ask({
    title: `删除系统「${sys.name}」？`,
    message: `该系统下的 ${sys.metricCount} 个指标及其**全部历史记录**将一并删除，操作不可恢复。`,
    danger: true,
    confirmText: '确认删除',
    requireText: sys.code,
  })
  if (!ok) return
  try {
    await $fetch(`/api/systems/${sys.id}`, { method: 'DELETE' })
    await dashboard.fetch()
    toast.success(`系统「${sys.name}」已删除`)
  } catch (err) {
    toast.error(errorMessage(err, '删除失败'))
  }
}
</script>

<style lang="scss" scoped>
.container_systems {
  max-width: 1200px;
  margin: 0 auto;
  padding: $space-5 $space-4 $space-6;
}

.container_systems_pageHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-4;
}

.container_systems_title {
  margin: 0;
  font-size: $font-xl;
}

.container_systems_search {
  width: 220px;

  .container_uiInput {
    width: 100%;
  }
}

.container_systems_nameLink {
  color: $color-text;
  font-weight: 500;

  &:hover {
    color: $color-primary;
  }
}

// 汇总列：色块条替代三段彩色文字
.container_systems_summaryBar {
  display: flex;
  gap: 2px;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--tc-hover);
}

.container_systems_summarySeg {
  min-width: 4px;

  &_normal { background: $color-normal; }
  &_warning { background: var(--tc-warning); }
  &_alarm { background: $color-alarm; }
}

.container_systems_actions {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  white-space: nowrap;
}

.container_systems_actionLink {
  font-size: $font-sm;
  color: $color-primary;

  &:hover {
    text-decoration: underline;
  }
}

.container_systems_dangerLink {
  color: $color-danger !important;
}
</style>
