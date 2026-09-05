<template>
  <span
    class="container_uiNumber"
    :class="{ container_uiNumber_invalid: invalid }"
  >
    <input
      v-bind="attrs"
      class="container_uiNumber_field"
      :value="value"
      type="text"
      inputmode="decimal"
      :disabled="disabled"
      :placeholder="placeholder"
      @input="onInput"
      @blur="emit('blur', $event as FocusEvent)"
    >
    <span v-if="unit" class="container_uiNumber_unit">{{ unit }}</span>
  </span>
</template>

<script setup lang="ts">
// 数字输入：右侧单位、输入过滤（数字/负号/小数点），值为可空字符串便于"未设置"
defineOptions({ name: 'UiNumber', inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  unit?: string
}>(), {
  unit: '',
})

const emit = defineEmits<{
  'update:modelValue': [string]
  blur: [FocusEvent]
}>()

const attrs = computed(() => {
  const rest: Record<string, unknown> = { ...useAttrs() }
  delete rest.class
  delete rest.style
  return rest
})

const value = computed(() => (props.modelValue ?? '') as string)

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  // 仅允许 - . 与数字，且只保留第一个负号/小数点
  let v = el.value.replace(/[^\d.\-]/g, '')
  const parts = v.split('.')
  if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join('')}`
  const negIdx = v.indexOf('-', 1)
  if (negIdx > 0) v = v.slice(0, negIdx)
  el.value = v
  emit('update:modelValue', v)
}
</script>

<style lang="scss" scoped>
.container_uiNumber {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  max-width: 100%;
  background: var(--tc-card-bg);
  border: 1px solid $color-border;
  border-radius: $radius-md;
  transition: border-color $dur-fast $ease-out, box-shadow $dur-fast $ease-out;

  &:focus-within {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px var(--tc-focus-ring);
  }

  &_invalid {
    border-color: $color-danger;
  }
}

.container_uiNumber_field {
  flex: 1;
  min-width: 0;
  width: 90px;
  height: $control-md;
  padding: 0 $space-2;
  border: none;
  background: transparent;
  outline: none;
  text-align: right;
  font-size: $font-base;
  color: inherit;

  &::placeholder {
    color: $color-text-secondary;
    opacity: 0.6;
  }
}

.container_uiNumber_unit {
  padding-right: $space-2;
  color: $color-text-secondary;
  font-size: $font-xs;
  white-space: nowrap;
}
</style>
