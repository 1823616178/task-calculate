<template>
  <div class="container_uiTable_wrap">
    <table class="container_uiTable">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="container_uiTable_th"
            :class="{ container_uiTable_numeric: col.numeric }"
            :style="colStyle(col)"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>

      <tbody>
        <!-- 骨架加载态 -->
        <template v-if="loading">
          <tr v-for="i in skeletonCount" :key="`sk_${i}`">
            <td v-for="(col, ci) in columns" :key="col.key" class="container_uiTable_td">
              <UiSkeleton :width="[72, 46, 58, 40][ci % 4] + '%'" height="12px" />
            </td>
          </tr>
        </template>

        <!-- 空态 -->
        <tr v-else-if="rows.length === 0">
          <td :colspan="columns.length" class="container_uiTable_emptyCell">
            <slot name="empty">
              <UiEmpty :text="emptyText" />
            </slot>
          </td>
        </tr>

        <!-- 数据行 -->
        <template v-else>
          <tr
            v-for="(row, index) in rows"
            :key="rowKeyOf(row)"
            class="container_uiTable_row"
            :class="props.rowClass?.(row, index)"
            :style="{ '--tc-row-delay': `${Math.min(index, 12) * 25}ms` }"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              class="container_uiTable_td"
              :class="{ container_uiTable_numeric: col.numeric }"
              :style="colStyle(col)"
            >
              <slot :name="cellSlotName(col)" :row="row" :index="index">
                {{ (row as Row)[col.key] }}
              </slot>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts" generic="RowT extends object">
// 配置化表格：
// - loading → 骨架行；空态插槽（补齐 systems 页缺失的空态）
// - 表头 sticky（默认偏移为顶栏高度）
// - 窄屏自动包进横向滚动容器 + 右缘阴影提示
// - 泛型行类型：插槽内的 row 保持调用方的 DTO 类型
export interface UiColumn {
  key: string
  label: string
  width?: number | string
  align?: 'left' | 'right' | 'center'
  /** 数字列：右对齐 + 等宽数字 */
  numeric?: boolean
}

type Row = Record<string, unknown>

const props = withDefaults(defineProps<{
  columns: UiColumn[]
  rows: RowT[]
  rowKey?: string
  loading?: boolean
  emptyText?: string
  skeletonRows?: number | string
  /** 按行追加 class（如禁用行降透明度） */
  rowClass?: (row: RowT, index: number) => string
}>(), {
  rowKey: 'id',
  emptyText: '暂无数据',
  skeletonRows: 5,
})

const skeletonCount = computed(() => Math.max(1, Number(props.skeletonRows) || 5))

function rowKeyOf(row: RowT): string | number {
  const key = props.rowKey
  const value: unknown = (row as Row)[key]
  return typeof value === 'number' || typeof value === 'string'
    ? value
    : JSON.stringify(row)
}

function cellSlotName(col: UiColumn): string {
  return `cell_${col.key}`
}

function colStyle(col: UiColumn): Record<string, string> {
  const style: Record<string, string> = {}
  if (col.width !== undefined) {
    style.width = typeof col.width === 'number' ? `${col.width}px` : col.width
  }
  const align = col.numeric ? 'right' : (col.align ?? 'left')
  if (align !== 'left') style.textAlign = align
  return style
}
</script>

<style lang="scss" scoped>
.container_uiTable_wrap {
  position: relative;
  background: $color-card-bg;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  overflow: visible;
  box-shadow: var(--tc-shadow-1);

  // 窄屏横向滚动 + 细滚动条
  @include down('lg') {
    overflow-x: auto;

    @include scrollbar;
  }
}

.container_uiTable {
  width: 100%;
  border-collapse: collapse;
}

.container_uiTable_th {
  padding: $space-2 $space-3;
  background: var(--tc-bg-subtle);
  color: $color-text-secondary;
  font-weight: 500;
  font-size: $font-sm;
  text-align: left;
  border-bottom: 1px solid $color-border;
  white-space: nowrap;

  // 贴边嵌入卡片时由外层把 --tc-table-radius 置 0
  &:first-child {
    border-top-left-radius: var(--tc-table-radius, #{$radius-card});
  }

  &:last-child {
    border-top-right-radius: var(--tc-table-radius, #{$radius-card});
  }
}

.container_uiTable_td {
  padding: $space-2 + 2 $space-3;
  border-bottom: 1px solid $color-border;
  font-size: $font-sm;
  color: $color-text;
  overflow-wrap: anywhere;
}

// 窄屏：单元格不折行，表格按内容撑开并在外层横向滚动（否则编码等会被逐字折断）
@include down('md') {
  .container_uiTable_td:not(.container_uiTable_emptyCell) {
    white-space: nowrap;
    overflow-wrap: normal;
  }
}

.container_uiTable_td:last-child,
.container_uiTable_th:last-child {
  padding-right: $space-4;
}

.container_uiTable_numeric {
  text-align: right;

  @include tabular-nums;
}

// 数据行入场：逐行上浮淡入（新增行同样生效，已渲染的行不会重播）
.container_uiTable_row {
  animation: tc-rise $dur-slow $ease-out both;
  animation-delay: var(--tc-row-delay, 0ms);

  > .container_uiTable_td {
    transition: background-color $dur-fast $ease-out;
  }
}

tbody tr:hover > .container_uiTable_td:not(.container_uiTable_emptyCell) {
  background: var(--tc-hover);
}

// 末行不再画分隔线，避免与卡片底边形成双线
tbody tr:last-child > .container_uiTable_td {
  border-bottom: none;
}

.container_uiTable_emptyCell {
  padding: 0 !important;
  animation: tc-fade $dur-slow $ease-out both;

  &:hover {
    background: transparent;
  }
}
</style>
