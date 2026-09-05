<template>
  <button
    :type="type"
    class="container_uiButton"
    :class="[
      `container_uiButton_${variant}`,
      `container_uiButton_${size}`,
      {
        container_uiButton_block: block,
        container_uiButton_loading: loading,
        container_uiButton_iconOnly: iconOnly,
      },
    ]"
    :disabled="disabled || loading"
    v-bind="attrs"
  >
    <UiSpinner
      v-if="loading"
      class="container_uiButton_spinner"
      :size="size === 'sm' ? 12 : 14"
    />
    <span class="container_uiButton_content"><slot /></span>
  </button>
</template>

<script setup lang="ts">
// 基础按钮：variant primary/secondary/ghost/danger/link；size sm/md/lg；loading 内置 spinner 自动 disabled；
// 默认 type="button"，表单提交需显式传 type="submit"。
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
  block?: boolean
  /** 仅图标（正方形），如主题切换 */
  iconOnly?: boolean
}>(), {
  variant: 'secondary',
  size: 'md',
  type: 'button',
})

const emit = defineEmits<{ click: [MouseEvent] }>()

const attrs = computed(() => {
  const rest = { ...useAttrs() }
  delete rest.class
  return rest
})

function onClick(e: MouseEvent) {
  if (props.disabled || props.loading) return
  emit('click', e)
}
</script>

<style lang="scss" scoped>
.container_uiButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  border: 1px solid transparent;
  font-size: $font-base;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color $dur-fast $ease-out, border-color $dur-fast $ease-out,
    color $dur-fast $ease-out, box-shadow $dur-fast $ease-out, opacity $dur-fast $ease-out;

  @include focus-ring;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.container_uiButton_content {
  display: inline-flex;
  align-items: center;
}

// 尺寸
.container_uiButton_sm {
  height: $control-sm;
  padding: 0 $space-3;
  font-size: $font-xs;
}

.container_uiButton_md {
  height: $control-md;
  padding: 0 $space-4;
}

.container_uiButton_lg {
  height: $control-lg;
  padding: 0 $space-5;
  font-size: $font-lg;
}

.container_uiButton_iconOnly {
  padding: 0;
}

.container_uiButton_sm.container_uiButton_iconOnly { width: $control-sm; }
.container_uiButton_md.container_uiButton_iconOnly { width: $control-md; }
.container_uiButton_lg.container_uiButton_iconOnly { width: $control-lg; }

// 变体
.container_uiButton_primary {
  background: $color-primary;
  color: #fff;

  &:hover:not(:disabled) {
    background: $color-primary-dark;
  }
}

.container_uiButton_secondary {
  background: var(--tc-card-bg);
  border-color: $color-border;
  color: $color-text;

  &:hover:not(:disabled) {
    background: var(--tc-hover);
    border-color: $color-text-secondary;
  }
}

.container_uiButton_ghost {
  background: transparent;
  color: $color-text-secondary;
  border-radius: $radius-md;

  &:hover:not(:disabled) {
    background: var(--tc-hover);
    color: $color-text;
  }
}

.container_uiButton_danger {
  background: $color-danger;
  color: #fff;

  &:hover:not(:disabled) {
    filter: brightness(0.92);
  }
}

.container_uiButton_link {
  background: none;
  border-color: transparent;
  padding-left: $space-1;
  padding-right: $space-1;
  color: $color-primary;

  &:hover:not(:disabled) {
    text-decoration: underline;
  }
}

.container_uiButton_block {
  display: flex;
  width: 100%;
}

.container_uiButton_loading {
  .container_uiButton_spinner {
    animation: container_uiButton_spin 0.8s linear infinite;
  }
}

@keyframes container_uiButton_spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
