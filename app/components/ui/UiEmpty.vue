<template>
  <div class="container_uiEmpty">
    <svg class="container_uiEmpty_art" viewBox="0 0 64 48" aria-hidden="true">
      <rect x="12" y="10" width="40" height="28" rx="4" fill="none" stroke="var(--tc-border)" stroke-width="2" />
      <path d="M20 24h24M20 30h14" stroke="var(--tc-border)" stroke-width="2" stroke-linecap="round" />
      <path d="M32 6l6 8h-12z" fill="var(--tc-border)" opacity="0.5" />
    </svg>
    <p class="container_uiEmpty_text">{{ text }}</p>
    <p v-if="description" class="container_uiEmpty_desc">{{ description }}</p>
    <div v-if="$slots.default" class="container_uiEmpty_action">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
  description?: string
}>(), { text: '暂无数据' })
</script>

<style lang="scss" scoped>
.container_uiEmpty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  padding: $space-8 $space-4;
  text-align: center;
}

.container_uiEmpty_art {
  width: 72px;
  height: 54px;
  opacity: 0.9;
}

.container_uiEmpty_text {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-base;
}

.container_uiEmpty_desc {
  margin: -4px 0 0;
  color: $color-text-secondary;
  font-size: $font-xs;
  max-width: 320px;
}

.container_uiEmpty_action {
  margin-top: $space-2;
}
</style>
