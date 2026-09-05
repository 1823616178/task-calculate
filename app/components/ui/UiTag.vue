<template>
  <span class="container_uiTag" :class="{ container_uiTag_closable: closable }">
    <slot />
    <button
      v-if="closable"
      type="button"
      class="container_uiTag_close"
      :aria-label="'移除' + ($attrs['aria-label'] as string || '标签')"
      @click="emit('close')"
    >×</button>
  </span>
</template>

<script setup lang="ts">
// 轻量标签：筛选条件 chips、当前用户标记等
withDefaults(defineProps<{ closable?: boolean }>(), { closable: false })

const emit = defineEmits<{ close: [] }>()
</script>

<style lang="scss" scoped>
.container_uiTag {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  padding: 0 $space-2;
  height: 20px;
  border-radius: $radius-sm;
  background: var(--tc-hover);
  color: $color-text-secondary;
  font-size: $font-xs;
  white-space: nowrap;
}

.container_uiTag_close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-right: -3px;
  padding: 0;
  border: none;
  border-radius: $radius-pill;
  background: transparent;
  color: inherit;
  font-size: $font-base;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: var(--tc-alarm-soft);
    color: $color-danger;
  }
}
</style>
