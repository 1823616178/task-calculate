<template>
  <div ref="rootEl" class="container_uiTabs" role="tablist" aria-label="页面分区">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :ref="(el) => setTabEl(tab.key, el)"
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

    <!-- 共用指示条：在选中项之间滑动（首帧定位不做过渡，避免从左侧飞入） -->
    <span
      class="container_uiTabs_ink"
      :class="{ container_uiTabs_ink_ready: inkReady }"
      :style="inkStyle"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

export interface UiTabItem {
  key: string
  label: string
  count?: number
}

const props = defineProps<{
  tabs: UiTabItem[]
  modelValue: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const rootEl = ref<HTMLElement | null>(null)
const tabEls = new Map<string, HTMLElement>()

function setTabEl(key: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) tabEls.set(key, el)
  else tabEls.delete(key)
}

const ink = ref({ left: 0, width: 0 })
const inkReady = ref(false)

const inkStyle = computed(() => ({
  transform: `translateX(${ink.value.left}px)`,
  width: `${ink.value.width}px`,
  opacity: ink.value.width > 0 ? 1 : 0,
}))

function measure() {
  const el = tabEls.get(props.modelValue)
  if (!el) {
    ink.value = { left: 0, width: 0 }
    return
  }
  // 与原下划线一致：左右各内缩 8px
  ink.value = { left: el.offsetLeft + 8, width: Math.max(0, el.offsetWidth - 16) }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  measure()
  // 等首帧定位生效后再开启过渡
  requestAnimationFrame(() => {
    inkReady.value = true
  })
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(rootEl.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

// 选中项或 tab 列表（计数变化会改变宽度）变化后重新定位
watch(() => [props.modelValue, props.tabs], () => {
  void nextTick(measure)
}, { deep: true })
</script>

<style lang="scss" scoped>
.container_uiTabs {
  position: relative;
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
  height: $control-lg + 2;
  padding: 0 $space-3;
  border: none;
  background: transparent;
  color: $color-text-secondary;
  font-size: $font-base;
  white-space: nowrap;
  cursor: pointer;
  transition: color $dur-fast $ease-out;

  // 悬停底色：圆角浮块，不干扰底部指示条
  &::before {
    content: '';
    position: absolute;
    inset: 5px 0;
    border-radius: $radius-md;
    background: var(--tc-hover);
    opacity: 0;
    transform: scale(0.94);
    transition: opacity $dur-fast $ease-out, transform $dur-base $ease-out;
    pointer-events: none;
  }

  &:hover {
    color: $color-text;

    &::before {
      opacity: 1;
      transform: none;
    }
  }
}

.container_uiTabs_tab_active {
  color: $color-primary;
  font-weight: 600;

  &:hover {
    color: $color-primary;
  }
}

.container_uiTabs_ink {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  border-radius: $radius-pill;
  background: $color-primary;
  pointer-events: none;

  &_ready {
    transition: transform $dur-slow $ease-out, width $dur-slow $ease-out, opacity $dur-fast $ease-out;
  }
}

.container_uiTabs_count {
  position: relative;
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: $radius-pill;
  background: var(--tc-hover);
  color: $color-text-secondary;
  font-size: $font-xs;
  transition: background-color $dur-base $ease-out, color $dur-base $ease-out;

  @include tabular-nums;
}

.container_uiTabs_tab_active .container_uiTabs_count {
  background: var(--tc-primary-soft);
  color: $color-primary;
}
</style>
