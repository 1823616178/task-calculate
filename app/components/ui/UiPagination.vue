<template>
  <nav class="container_uiPagination" aria-label="分页">
    <div v-if="pageSizes.length > 0" class="container_uiPagination_size">
      <span class="container_uiPagination_sizeLabel">每页</span>
      <UiSelect
        :model-value="pageSize"
        size="sm"
        aria-label="每页条数"
        @update:model-value="(v) => emit('update:pageSize', Number(v))"
      >
        <option v-for="s in pageSizes" :key="s" :value="s">{{ s }}</option>
      </UiSelect>
      <span>条</span>
    </div>

    <UiButton variant="secondary" size="sm" :disabled="prevDisabled" @click="go(page - 1)">
      上一页
    </UiButton>

    <!-- 页码模式：totalPages 已知时展示数字页码 -->
    <template v-if="totalPages > 0">
      <button
        v-for="p in visiblePages"
        :key="p"
        type="button"
        class="container_uiPagination_num"
        :class="{ container_uiPagination_num_active: p === page }"
        :aria-current="p === page ? 'page' : undefined"
        @click="go(p)"
      >
        {{ p }}
      </button>
    </template>

    <span v-else class="container_uiPagination_info">
      第 {{ page }} 页{{ total !== null ? `，共 ${total} 条` : '' }}
    </span>

    <UiButton variant="secondary" size="sm" :disabled="nextDisabled" @click="go(page + 1)">
      下一页
    </UiButton>

    <template v-if="totalPages > 0 && total !== null">
      <span class="container_uiPagination_total">共 {{ total }} 条</span>
    </template>
  </nav>
</template>

<script setup lang="ts">
// 统一分页 UI：
// - 页码分页（audit）：传 totalPages（+可选 total）
// - 游标分页（records keyset）：不传 totalPages、传 hasNext；prev 由内部维护的 page 推导
const props = withDefaults(defineProps<{
  page: number
  /** 无值表示游标分页模式 */
  totalPages?: number | null
  hasNext?: boolean
  total?: number | null
  pageSize?: number
  pageSizes?: number[]
}>(), {
  totalPages: null,
  hasNext: undefined,
  total: null,
  pageSize: 20,
})

const emit = defineEmits<{
  'update:page': [number]
  'update:pageSize': [number]
}>()

const prevDisabled = computed(() => props.page <= 1)

// 游标模式必须显式给 hasNext 才能判断是否可下一页
const nextDisabled = computed(() => {
  if (props.totalPages != null) return props.page >= props.totalPages
  return props.hasNext === false
})

function go(p: number) {
  const target = Math.max(1, Math.min(p, props.totalPages ?? p))
  if (target === props.page) return
  emit('update:page', target)
}

// 数字页码窗口：前后各 1 页 + 首末页 + 省略号位置用折叠近似
const visiblePages = computed<(number)[]>(() => {
  if (props.totalPages == null || props.totalPages <= 0) return []
  const tp = props.totalPages
  const cur = props.page
  const windowSize = 5
  let start = Math.max(1, cur - Math.floor(windowSize / 2))
  const end = Math.min(tp, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})
</script>

<style lang="scss" scoped>
.container_uiPagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  margin-top: $space-4;
  flex-wrap: wrap;
}

.container_uiPagination_info {
  color: $color-text-secondary;
  font-size: $font-sm;

  @include tabular-nums;
}

.container_uiPagination_total {
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_uiPagination_num {
  min-width: $control-sm;
  height: $control-sm;
  padding: 0 $space-2;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: $color-text-secondary;
  font-size: $font-sm;

  @include tabular-nums;

  cursor: pointer;

  &:hover:not(.container_uiPagination_num_active) {
    background: var(--tc-hover);
    color: $color-text;
  }
}

.container_uiPagination_num_active {
  background: var(--tc-active);
  color: $color-primary;
  font-weight: 600;
}

.container_uiPagination_size {
  display: flex;
  align-items: center;
  gap: $space-1;
  color: $color-text-secondary;
  font-size: $font-xs;
}
</style>
