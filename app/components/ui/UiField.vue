<template>
  <div class="container_uiField" :class="{ container_uiField_invalid: !!error }">
    <label v-if="label || $slots.label" class="container_uiField_label" :for="htmlFor">
      <slot name="label">{{ label }}</slot>
      <span v-if="required" class="container_uiField_required" aria-hidden="true">*</span>
    </label>

    <div class="container_uiField_control">
      <slot />
    </div>

    <p v-if="error" class="container_uiField_error" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="container_uiField_hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
// 表单字段容器：label + 必填星号 + hint + error，包裹 UiInput/UiSelect 等控件，
// 解决"全靠 placeholder 表意"的问题。
withDefaults(defineProps<{
  label?: string
  required?: boolean
  hint?: string
  error?: string
  htmlFor?: string
}>(), {
  label: '',
})
</script>

<style lang="scss" scoped>
.container_uiField {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  min-width: 0;
}

.container_uiField_label {
  font-size: $font-sm;
  font-weight: 500;
  color: $color-text;
}

.container_uiField_required {
  margin-left: $space-1;
  color: $color-danger;
}

.container_uiField_control {
  min-width: 0;

  // 容器内的输入类控件默认占满宽度（控件来自插槽，scoped 样式须用 :slotted 才能命中）
  > :slotted(.container_uiInput),
  > :slotted(.container_uiSelect),
  > :slotted(.container_uiTextarea),
  > :slotted(.container_uiNumber) {
    width: 100%;
  }
}

.container_uiField_error {
  margin: 0;
  color: $color-danger;
  font-size: $font-xs;
}

.container_uiField_hint {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-xs;
}
</style>
