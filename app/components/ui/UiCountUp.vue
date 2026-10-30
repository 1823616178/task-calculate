<template>
  <span class="container_uiCountUp">{{ shown }}</span>
</template>

<script setup lang="ts">
// 数字滚动：值变化时从旧值平滑过渡到新值（首屏从 0 起跳）。
// 系统开启"减弱动效"时直接显示终值。
const props = withDefaults(defineProps<{
  value: number
  /** 过渡时长（毫秒） */
  duration?: number
}>(), {
  duration: 700,
})

const shown = ref(0)
let frame = 0

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function animateTo(target: number) {
  if (frame) cancelAnimationFrame(frame)
  const from = shown.value
  if (from === target || prefersReducedMotion()) {
    shown.value = target
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / props.duration)
    // easeOutCubic
    const eased = 1 - (1 - t) ** 3
    shown.value = Math.round(from + (target - from) * eased)
    frame = t < 1 ? requestAnimationFrame(step) : 0
  }
  frame = requestAnimationFrame(step)
}

onMounted(() => animateTo(props.value))

watch(() => props.value, (v) => animateTo(v))

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
})
</script>

<style lang="scss" scoped>
.container_uiCountUp {
  @include tabular-nums;
}
</style>
