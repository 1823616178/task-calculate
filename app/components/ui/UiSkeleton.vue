<template>
  <span
    class="container_uiSkeleton"
    :class="`container_uiSkeleton_${variant}`"
    :style="style"
  />
</template>

<script setup lang="ts">
// 骨架占位：line（一行文本）/ block（整块）/ circle（圆形头像）
const props = withDefaults(defineProps<{
  variant?: 'line' | 'block' | 'circle'
  width?: string
  height?: string
}>(), {
  variant: 'line',
})

const style = computed(() => {
  const s: Record<string, string> = {}
  if (props.width) s.width = props.width
  if (props.height) s.height = props.height
  if (props.variant === 'line') {
    s.width = s.width ?? '100%'
    s.height = s.height ?? '12px'
  }
  if (props.variant === 'circle') s.height = s.width
  return s
})
</script>

<style lang="scss" scoped>
.container_uiSkeleton {
  display: block;
  border-radius: $radius-sm;
  background: linear-gradient(
    100deg,
    var(--tc-bg-subtle) 40%,
    var(--tc-hover) 50%,
    var(--tc-bg-subtle) 60%
  );
  background-size: 200% 100%;
  animation: container_uiSkeleton_shimmer 1.4s ease infinite;
}

.container_uiSkeleton_block {
  border-radius: $radius-md;
}

.container_uiSkeleton_circle {
  border-radius: $radius-pill;
}

@keyframes container_uiSkeleton_shimmer {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}
</style>
