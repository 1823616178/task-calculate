<template>
  <header class="container_uiPageHead">
    <div class="container_uiPageHead_text">
      <h1 class="container_uiPageHead_title">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="description || $slots.description" class="container_uiPageHead_desc">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="container_uiPageHead_actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
// 页面标题栏：标题 + 一句说明 + 右侧主操作，统一各列表页的页头样式与入场动效
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: '',
  description: '',
})
</script>

<style lang="scss" scoped>
.container_uiPageHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3 $space-4;
  flex-wrap: wrap;
  margin-bottom: $space-5;
  animation: tc-rise $dur-slow $ease-out both;
}

.container_uiPageHead_text {
  min-width: 0;
}

.container_uiPageHead_title {
  margin: 0;
  font-size: $font-xl + 2;
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 1.3;
}

.container_uiPageHead_desc {
  margin: $space-1 0 0;
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_uiPageHead_actions {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-shrink: 0;
}
</style>
