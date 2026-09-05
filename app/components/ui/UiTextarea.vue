<template>
  <textarea
    v-bind="attrs"
    class="container_uiTextarea"
    :class="{ container_uiTextarea_invalid: invalid }"
    :value="(modelValue ?? '') as string"
    :disabled="disabled"
    :placeholder="placeholder"
    :rows="rows"
    @input="onInput"
  />
</template>

<script setup lang="ts">
defineOptions({ name: 'UiTextarea', inheritAttrs: false })

withDefaults(defineProps<{
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  rows?: number
}>(), { rows: 3 })

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const attrs = computed(() => {
  const rest: Record<string, unknown> = { ...useAttrs() }
  delete rest.class
  delete rest.style
  return rest
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>

<style lang="scss" scoped>
.container_uiTextarea {
  display: block;
  width: 100%;
  padding: $space-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  background: var(--tc-card-bg);
  color: inherit;
  font-size: $font-base;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color $dur-fast $ease-out, box-shadow $dur-fast $ease-out;

  &:focus-visible {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px var(--tc-focus-ring);
  }

  &::placeholder {
    color: $color-text-secondary;
    opacity: 0.75;
  }
}

.container_uiTextarea_invalid {
  border-color: $color-danger;
}
</style>
