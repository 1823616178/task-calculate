<template>
  <select
    v-bind="attrs"
    class="container_uiSelect"
    :class="[`container_uiSelect_${size}`, { container_uiSelect_invalid: invalid }]"
    :value="(modelValue ?? '') as string | number | undefined"
    :disabled="disabled"
    @change="onChange"
  >
    <slot />
  </select>
</template>

<script setup lang="ts">
// 统一下拉框：$control 高度 + 自绘箭头（appearance:none）+ 暗色底色
defineOptions({ name: 'UiSelect', inheritAttrs: false })

withDefaults(defineProps<{
  modelValue?: string | number | null
  disabled?: boolean
  invalid?: boolean
  size?: 'sm' | 'md'
}>(), { size: 'md' })

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const attrs = computed(() => {
  const rest: Record<string, unknown> = { ...useAttrs() }
  delete rest.class
  delete rest.style
  return rest
})

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<style lang="scss" scoped>
.container_uiSelect {
  height: $control-md;
  max-width: 100%;
  padding: 0 $space-5 0 $space-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  background-color: var(--tc-card-bg);
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M1 3l4 4 4-4' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  appearance: none;
  -webkit-appearance: none;
  font-size: $font-base;
  cursor: pointer;
  outline: none;
  transition: border-color $dur-fast $ease-out, box-shadow $dur-fast $ease-out;

  &:hover:not(:disabled) {
    border-color: $color-text-secondary;
  }

  &:focus-visible {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px var(--tc-focus-ring);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  option {
    background: var(--tc-card-bg);
    color: var(--tc-text);
  }
}

.container_uiSelect_sm {
  height: $control-sm;
  font-size: $font-sm;
}

.container_uiSelect_invalid {
  border-color: $color-danger;
}
</style>
