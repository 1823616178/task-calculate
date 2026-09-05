<template>
  <UiBadge
    :variant="variant"
    icon
    size="sm"
  >{{ label }}</UiBadge>
</template>

<script setup lang="ts">
import type { MetricStatus } from '../../shared/types'

// 状态徽标：迁到 UiBadge 底座，附带 ✓/!/✕/– 符号区分（不只靠颜色编码）
const props = defineProps<{ status: MetricStatus }>()

const VARIANT_MAP = {
  normal: 'normal',
  warning: 'warning',
  alarm: 'alarm',
  none: 'neutral',
} as const

const labels: Record<MetricStatus, string> = {
  normal: '正常',
  warning: '预警',
  alarm: '告警',
  none: '未判定',
}

const variant = computed(() => VARIANT_MAP[props.status])
const label = computed(() => labels[props.status])
</script>
