<template>
  <Teleport to="body">
    <div class="container_uiToastHost" aria-live="polite" role="status">
      <TransitionGroup name="ui-toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="container_uiToastHost_item"
          :class="`container_uiToastHost_item_${t.type}`"
          @mouseenter="pause(t.id)"
          @mouseleave="resume(t.id)"
        >
          <span class="container_uiToastHost_icon" aria-hidden="true">{{ ICONS[t.type] }}</span>
          <p class="container_uiToastHost_message">{{ t.message }}</p>
          <button
            type="button"
            class="container_uiToastHost_close"
            aria-label="关闭通知"
            @click="dismiss(t.id)"
          >×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// 全局 Toast 宿主：挂在 layouts/default.vue，右上角堆叠，可悬停暂停自动消失
const { toasts, pause, resume, dismiss } = useToast()

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
}
</script>

<style lang="scss" scoped>
.container_uiToastHost {
  position: fixed;
  top: $space-4;
  right: $space-4;
  z-index: $z-toast;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: $space-2;
  width: min(360px, calc(100vw - #{$space-6}));
  pointer-events: none;
}

.container_uiToastHost_item {
  display: flex;
  align-items: flex-start;
  gap: $space-2;
  width: 100%;
  padding: $space-3;
  border-radius: $radius-lg;
  background: var(--tc-card-bg);
  border: 1px solid $color-border;
  box-shadow: var(--tc-shadow-2);
  pointer-events: auto;
  animation: container_uiToastHost_in $dur-base $ease-out;
}

@keyframes container_uiToastHost_in {
  from {
    opacity: 0;
    transform: translateX(16px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.container_uiToastHost_icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: $radius-pill;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;

  .container_uiToastHost_item_success & { background: $color-normal; }
  .container_uiToastHost_item_error & { background: $color-danger; }
  .container_uiToastHost_item_warning & { background: var(--tc-warning); }
  .container_uiToastHost_item_info & { background: $color-primary; }
}

.container_uiToastHost_message {
  flex: 1;
  margin: 0;
  font-size: $font-sm;
  line-height: 1.5;
  word-break: break-word;
}

.container_uiToastHost_close {
  border: none;
  background: none;
  padding: 0;
  color: $color-text-secondary;
  font-size: $font-base;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: $color-text;
  }
}

.ui-toast-leave-active {
  transition: opacity $dur-fast ease, transform $dur-fast ease;
}

.ui-toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
