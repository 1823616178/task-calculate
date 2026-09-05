<template>
  <div class="container_uiTabs" role="tablist" aria-label="页面分区">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      class="container_uiTabs_tab"
      :class="{ container_uiTabs_tab_active: tab.key === modelValue }"
      :aria-selected="tab.key === modelValue ? 'true' : 'false'"
      @click="emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
      <span v-if="tab.count !== undefined" class="container_uiTabs_count">{{ tab.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
export interface UiTabItem {
  key: string
  label: string
  count?: number
}

defineProps<{
  tabs: UiTabItem[]
  modelValue: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<style lang="scss" scoped>
.container_uiTabs {
  display: flex;
  align-items: stretch;
  gap: $space-1;
  border-bottom: 1px solid $color-border;
  overflow-x: auto;

  @include scrollbar;
}

.container_uiTabs_tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  height: $control-lg;
  padding: 0 $space-3;
  border: none;
  background: transparent;
  color: $color-text-secondary;
  font-size: $font-base;
  white-space: nowrap;
  cursor: pointer;
  transition: color $dur-fast $ease-out;

  &:hover {
    color: $color-text;
  }

  &::after {
    content: '';
    position: absolute;
    left: $space-2;
    right: $space-2;
    bottom: -1px;
    height: 2px;
    border-radius: 999px;
    background: $color-primary;
    transform: scaleX(0);
    transition: transform $dur-base $ease-out;
  }
}

.container_uiTabs_tab_active {
  color: $color-primary;
  font-weight: 600;

  &::after {
    transform: scaleX(1);
  }
}

.container_uiTabs_count {
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--tc-hover);
  color: $color-text-secondary;
  font-size: $font-xs;

  @include tabular-nums;
}

.container_uiTabs_tab_active .container_uiTabs_count {
  background: var(--tc-primary-soft);
  color: $color-primary;
}
</style>
