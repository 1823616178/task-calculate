<template>
  <Teleport to="body">
    <Transition name="ui-modal" appear>
      <div
        v-if="modelValue"
        class="container_uiModal"
        role="presentation"
        @mousedown.self="onMask"
      >
        <div
          ref="panelEl"
          class="container_uiModal_panel"
          :class="`container_uiModal_panel_${size}`"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel || title || '对话框'"
          tabindex="-1"
          @keydown.tab="onTab"
          @keydown.esc.stop.prevent="onEsc"
        >
          <header class="container_uiModal_header">
            <h2 class="container_uiModal_title">
              <slot name="title">{{ title }}</slot>
            </h2>
            <button
              v-if="closable"
              type="button"
              class="container_uiModal_close"
              aria-label="关闭"
              @click="close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <div class="container_uiModal_body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="container_uiModal_footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// 弹窗基础组件：
// - Teleport to body / 遮罩点击关闭（可关） / ESC 关闭（仅最顶层响应）
// - focus trap（Tab 循环）+ 打开时聚焦 + 关闭后焦点还原
// - 打开期间锁定 body 滚动（多层计数）
// - size: sm|md|lg|full；具名插槽 header|body(默认)|footer
const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'full'
  closable?: boolean
  closeOnMask?: boolean
  ariaLabel?: string
}>(), {
  title: '',
  size: 'md',
  closable: true,
  closeOnMask: true,
})

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const panelEl = ref<HTMLElement | null>(null)
let prevFocused: HTMLElement | null = null
let leaveFn: (() => void) | null = null

function open() {
  if (import.meta.client) prevFocused = document.activeElement as HTMLElement | null
  leaveFn = modal.enter()
  nextTick(() => {
    const target = getFirstFocusable(panelEl.value) ?? panelEl.value
    target?.focus()
  })
}

function cleanup() {
  if (leaveFn) {
    leaveFn()
    leaveFn = null
  }
  if (prevFocused && import.meta.client) {
    try {
      prevFocused.focus()
    } catch {
      // 原元素可能已被卸载，忽略还原失败
    }
  }
  prevFocused = null
}

watch(
  () => props.modelValue,
  (openNow) => {
    if (openNow) open()
    else cleanup()
  },
)

onMounted(() => {
  if (props.modelValue) open()
})

onBeforeUnmount(() => {
  if (props.modelValue) cleanup()
})

function close() {
  emit('update:modelValue', false)
}

function onMask(e: MouseEvent) {
  if (!props.closeOnMask) return
  // 只有遮罩自身命中才关闭（防拖拽误关）
  if ((e.target as HTMLElement).classList.contains('container_uiModal')) close()
}

function onEsc() {
  if (modal.isTopmost()) close()
}

function onTab(e: KeyboardEvent) {
  trapTabKey(e, panelEl.value)
}

const modal = useModal()
</script>

<style lang="scss" scoped>
.container_uiModal {
  position: fixed;
  inset: 0;
  z-index: $z-modal;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 64px $space-4 $space-6;
  background: var(--tc-overlay);
  backdrop-filter: blur(2px);
  overflow-y: auto;

  @include scrollbar;
}

.container_uiModal_panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100vh - 96px);
  background: var(--tc-card-bg);
  border: 1px solid $color-border;
  border-radius: $radius-xl;
  box-shadow: var(--tc-shadow-2);

  &:focus-visible {
    outline: none;
  }

  &_sm { max-width: 400px; }
  &_md { max-width: 560px; }
  &_lg { max-width: 860px; }
  &_full { max-width: 1200px; }
}

.container_uiModal_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4 $space-5;
  border-bottom: 1px solid $color-border;
  flex-shrink: 0;
}

.container_uiModal_title {
  margin: 0;
  font-size: $font-lg;
  font-weight: 600;
}

.container_uiModal_close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: $color-text-secondary;
  cursor: pointer;

  transition: background-color $dur-fast $ease-out, color $dur-fast $ease-out, transform $dur-base $ease-out;

  &:hover {
    background: var(--tc-hover);
    color: $color-text;
    transform: rotate(90deg);
  }
}

.container_uiModal_body {
  padding: $space-5;
  overflow-y: auto;

  @include scrollbar;

  :deep(form) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: $space-4;
  }
}

.container_uiModal_footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: $space-2;
  padding: $space-3 $space-5;
  border-top: 1px solid $color-border;
  flex-shrink: 0;
}

// 进出场动效（prefers-reduced-motion 时由全局规则关闭）
.ui-modal-enter-active,
.ui-modal-leave-active {
  transition: opacity $dur-base $ease-out;

  .container_uiModal_panel {
    transition: transform $dur-slow $ease-out, opacity $dur-base $ease-out;
  }
}

.ui-modal-leave-active .container_uiModal_panel {
  transition-duration: $dur-base;
}

.ui-modal-enter-from,
.ui-modal-leave-to {
  opacity: 0;

  .container_uiModal_panel {
    transform: translateY(16px) scale(0.97);
    opacity: 0;
  }
}
</style>
