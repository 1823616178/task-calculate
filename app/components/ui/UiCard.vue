<template>
  <section class="container_uiCard" :class="{ container_uiCard_hoverable: hoverable, container_uiCard_flat: flat }">
    <header v-if="title || $slots.title || $slots.actions" class="container_uiCard_head">
      <div class="container_uiCard_title">
        <slot name="title">{{ title }}</slot>
      </div>
      <div v-if="$slots.actions" class="container_uiCard_actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="container_uiCard_body" :class="{ container_uiCard_body_flush: flush }">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="container_uiCard_footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
// 卡片容器：替换散落的 @include card；带 title / actions / footer 插槽
withDefaults(defineProps<{
  title?: string
  hoverable?: boolean
  /** 去掉内边距（表格等贴边场景） */
  flush?: boolean
  /** 无边框轻量卡片 */
  flat?: boolean
}>(), {
  title: '',
})
</script>

<style lang="scss" scoped>
.container_uiCard {
  background: $color-card-bg;
  border: 1px solid $color-border;
  border-radius: $radius-card;

  &:not(.container_uiCard_flat) {
    box-shadow: var(--tc-shadow-1);
  }
}

.container_uiCard_hoverable {
  transition: box-shadow $dur-base $ease-out, transform $dur-base $ease-out;

  &:hover {
    box-shadow: var(--tc-shadow-2);
    transform: translateY(-2px);
  }
}

.container_uiCard_head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4 $space-4 0;

  &:has(+ .container_uiCard_body:not(.container_uiCard_body_flush)) {
    padding-bottom: $space-3;
  }

  + .container_uiCard_body_flush {
    padding-top: $space-3;
  }
}

.container_uiCard_title {
  font-size: $font-lg;
  font-weight: 600;
  color: $color-text;
}

.container_uiCard_actions {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-shrink: 0;
}

.container_uiCard_body {
  padding: $space-4;
}

.container_uiCard_body_flush {
  padding: 0;
}

.container_uiCard_footer {
  padding: $space-3 $space-4;
  border-top: 1px solid $color-border;
}
</style>
