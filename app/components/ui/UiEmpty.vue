<template>
  <div class="container_uiEmpty">
    <div class="container_uiEmpty_artWrap" aria-hidden="true">
      <svg class="container_uiEmpty_art" viewBox="0 0 96 72">
        <ellipse class="container_uiEmpty_shadow" cx="48" cy="64" rx="26" ry="4" />
        <g class="container_uiEmpty_box">
          <rect x="20" y="16" width="56" height="40" rx="7" fill="var(--tc-card-bg)" stroke="var(--tc-border)" stroke-width="2" />
          <path d="M20 28h56" stroke="var(--tc-border)" stroke-width="2" />
          <circle cx="28" cy="22" r="2" fill="var(--tc-border)" />
          <circle cx="35" cy="22" r="2" fill="var(--tc-border)" />
          <path d="M30 40h26M30 47h16" stroke="var(--tc-border)" stroke-width="2.5" stroke-linecap="round" />
          <circle cx="66" cy="44" r="5" fill="var(--tc-primary-soft)" stroke="var(--tc-primary)" stroke-width="1.6" opacity="0.8" />
        </g>
      </svg>
    </div>
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
  animation: tc-rise $dur-slow $ease-out both;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  padding: $space-8 $space-4;
  text-align: center;
}

.container_uiEmpty_artWrap {
  margin-bottom: $space-1;
}

.container_uiEmpty_art {
  display: block;
  width: 96px;
  height: 72px;
}

// 插画轻微悬浮 + 投影同步缩放
.container_uiEmpty_box {
  animation: container_uiEmpty_float 3.2s ease-in-out infinite;
}

.container_uiEmpty_shadow {
  fill: var(--tc-hover);
  transform-origin: 48px 64px;
  animation: container_uiEmpty_shadow 3.2s ease-in-out infinite;
}

@keyframes container_uiEmpty_float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-4px);
  }
}

@keyframes container_uiEmpty_shadow {
  0%,
  100% {
    transform: scaleX(1);
    opacity: 1;
  }

  50% {
    transform: scaleX(0.82);
    opacity: 0.6;
  }
}

.container_uiEmpty_text {
  margin: 0;
  color: $color-text;
  font-size: $font-base;
  font-weight: 500;
}

.container_uiEmpty_desc {
  margin: -$space-1 0 0;
  color: $color-text-secondary;
  font-size: $font-sm;
  line-height: 1.6;
  max-width: 340px;
}

.container_uiEmpty_action {
  margin-top: $space-2;
}
</style>
