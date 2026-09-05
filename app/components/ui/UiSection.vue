<template>
  <section class="container_uiSection">
    <header v-if="title || $slots.actions" class="container_uiSection_head">
      <h2 class="container_uiSection_title">
        <slot name="title">{{ title }}</slot>
      </h2>
      <div v-if="$slots.actions" class="container_uiSection_actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="container_uiSection_body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
// 区块容器：标题 + 动作区 + 内容。区别于 UiCard（自带卡片视觉），
// UiSection 用于页面级分组与 Tabs 内部组织。
withDefaults(defineProps<{ title?: string }>(), { title: '' })
</script>

<style lang="scss" scoped>
.container_uiSection {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.container_uiSection_head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
}

.container_uiSection_title {
  margin: 0;
  font-size: $font-lg;
  font-weight: 600;
}

.container_uiSection_actions {
  display: flex;
  align-items: center;
  gap: $space-2;
}
</style>
