<template>
  <button
    type="button"
    role="switch"
    class="container_uiSwitch"
    :class="{ container_uiSwitch_checked: modelValue, container_uiSwitch_disabled: disabled }"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-label="ariaLabel"
    :disabled="disabled"
    @click="toggle"
  >
    <span class="container_uiSwitch_thumb" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
// 开关控件：替换全站 12 处"启用/禁用"文字按钮
const props = withDefaults(defineProps<{
  modelValue: boolean
  disabled?: boolean
  ariaLabel?: string
}>(), {})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  change: [boolean]
}>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
  emit('change', !props.modelValue)
}
</script>

<style lang="scss" scoped>
.container_uiSwitch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 36px;
  height: 20px;
  padding: 2px;
  border: none;
  border-radius: $radius-pill;
  background: var(--tc-none-soft);
  cursor: pointer;
  transition: background-color $dur-base $ease-out;
  vertical-align: middle;

  &_checked {
    background: $color-primary;
  }

  &_disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tc-focus-ring);
  }
}

.container_uiSwitch_thumb {
  width: 16px;
  height: 16px;
  border-radius: $radius-pill;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
  transition: transform $dur-slow $ease-spring, width $dur-base $ease-out, margin $dur-base $ease-out;
}

.container_uiSwitch_checked .container_uiSwitch_thumb {
  transform: translateX(16px);
}

// 按住时滑块拉长（iOS 风格的按压反馈）
.container_uiSwitch:active:not(:disabled) .container_uiSwitch_thumb {
  width: 20px;
}

.container_uiSwitch_checked:active:not(:disabled) .container_uiSwitch_thumb {
  margin-left: -4px;
}
</style>
