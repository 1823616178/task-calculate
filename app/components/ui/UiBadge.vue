<template>
  <span
    class="container_uiBadge"
    :class="[`container_uiBadge_${variant}`, `container_uiBadge_${size}`]"
  >
    <span v-if="icon" class="container_uiBadge_icon" aria-hidden="true">{{ glyph }}</span>
    <span
      v-else-if="dot"
      class="container_uiBadge_dot"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>

<script setup lang="ts">
// 徽标底座：soft 底色 + 深色文字（修正暗色下白字压 warning 底对比度不足的问题）。
// icon 变体在状态上附带形状符号，不只靠颜色编码；dot 变体用于轻量状态点。
const props = withDefaults(defineProps<{
  variant?: 'normal' | 'warning' | 'alarm' | 'none' | 'primary' | 'neutral'
  size?: 'sm' | 'md'
  dot?: boolean
  /** 附加符号 ✓ / ! / ✕ / – */
  icon?: boolean
}>(), {
  variant: 'neutral',
  size: 'md',
})

const GLYPHS: Record<string, string> = {
  normal: '✓',
  warning: '!',
  alarm: '✕',
  none: '–',
  primary: '',
  neutral: '·',
}

const glyph = computed(() => GLYPHS[props.variant] ?? '')
</script>

<style lang="scss" scoped>
.container_uiBadge {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  border-radius: $radius-pill;
  font-weight: 500;
  white-space: nowrap;
}

.container_uiBadge_md {
  padding: 1px $space-2;
  font-size: $font-xs;
  line-height: 18px;
}

.container_uiBadge_sm {
  padding: 0 $space-2;
  font-size: $font-xs;
  line-height: 16px;
}

.container_uiBadge_icon {
  font-size: $font-xs;
  line-height: 1;
  font-weight: 700;
}

.container_uiBadge_dot {
  width: 6px;
  height: 6px;
  border-radius: $radius-pill;
  background: currentColor;
}

// soft 底 + 同色系文字
.container_uiBadge_normal { background: var(--tc-normal-soft); color: $color-normal; }
.container_uiBadge_warning { background: var(--tc-warning-soft); color: var(--tc-warning); }
.container_uiBadge_alarm { background: var(--tc-alarm-soft); color: $color-alarm; }
.container_uiBadge_none { background: var(--tc-none-soft); color: $color-none; }
.container_uiBadge_primary { background: var(--tc-primary-soft); color: $color-primary; }
.container_uiBadge_neutral { background: var(--tc-hover); color: $color-text-secondary; }
</style>
