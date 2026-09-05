<template>
  <span
    class="container_uiInput"
    :class="[
      `container_uiInput_${size}`,
      {
        container_uiInput_invalid: invalid,
        container_uiInput_disabled: disabled,
        container_uiInput_prefixed: $slots.prepend,
        container_uiInput_suffixed: $slots.append || type === 'password' || suffix,
      },
    ]"
  >
    <span v-if="$slots.prepend" class="container_uiInput_prepend"><slot name="prepend" /></span>

    <input
      class="container_uiInput_field"
      v-bind="attrs"
      :value="value"
      :type="shownType"
      :disabled="disabled"
      :placeholder="placeholder"
      :invalid="invalid ? 'true' : undefined"
      @input="onInput"
      @blur="emit('blur', $event)"
      @keydown.enter="emit('enter', $event)"
    >

    <button
      v-if="type === 'password'"
      type="button"
      class="container_uiInput_eye"
      :aria-label="revealed ? '隐藏密码' : '显示密码'"
      :title="revealed ? '隐藏密码' : '显示密码'"
      tabindex="-1"
      @click.prevent="revealed = !revealed"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8" />
      </svg>
    </button>

    <span v-if="$slots.append || suffix" class="container_uiInput_append">
      <slot name="append">{{ suffix }}</slot>
    </span>
  </span>
</template>

<script setup lang="ts">
// 统一输入框：$control 高度、focus-ring、暗色底色、invalid 态、前后缀插槽；
// password 自带可见性切换。
defineOptions({ name: 'UiInput', inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  type?: 'text' | 'password' | 'number'
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  size?: 'sm' | 'md'
  /** 右侧单位后缀（如 ℃ / 秒） */
  suffix?: string
}>(), {
  type: 'text',
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [string]
  blur: [FocusEvent]
  enter: [KeyboardEvent]
}>()

const attrs = computed(() => {
  const rest: Record<string, unknown> = { ...useAttrs() }
  delete rest.class
  delete rest.style
  return rest
})

const revealed = ref(false)
const shownType = computed(() => {
  if (props.type !== 'password') return props.type
  return revealed.value ? 'text' : 'password'
})

const value = computed(() => (props.modelValue ?? '') as string)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<style lang="scss" scoped>
.container_uiInput {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  background: var(--tc-card-bg);
  border: 1px solid $color-border;
  border-radius: $radius-md;
  transition: border-color $dur-fast $ease-out, box-shadow $dur-fast $ease-out;
  max-width: 100%;

  &:focus-within {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px var(--tc-focus-ring);
  }

  &_sm .container_uiInput_field,
  &.container_uiInput_sm {
    height: $control-sm;
    font-size: $font-sm;
  }

  &_invalid {
    border-color: $color-danger;

    &:focus-within {
      box-shadow: 0 0 0 2px var(--tc-alarm-soft);
    }
  }

  &_disabled {
    opacity: 0.55;
    background: var(--tc-bg-subtle);
  }
}

.container_uiInput_field {
  flex: 1;
  min-width: 0;
  height: $control-md;
  padding: 0 $space-2;
  border: none;
  background: transparent;
  outline: none;
  font-size: $font-base;
  color: inherit;

  &::placeholder {
    color: $color-text-secondary;
    opacity: 0.75;
  }
}

.container_uiInput_prepend,
.container_uiInput_append {
  display: inline-flex;
  align-items: center;
  color: $color-text-secondary;
  font-size: $font-xs;
}

.container_uiInput_append {
  padding-right: $space-2;
}

.container_uiInput_eye {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: $space-1;
  padding: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $color-text-secondary;
  cursor: pointer;

  &:hover {
    color: $color-text;
  }
}
</style>
