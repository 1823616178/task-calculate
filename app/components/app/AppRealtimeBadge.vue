<template>
  <div class="container_appRealtimeBadge">
    <button
      type="button"
      class="container_appRealtimeBadge_pill"
      :class="{ container_appRealtimeBadge_pill_disconnected: !realtime.connected }"
      :title="title"
      :aria-label="`实时连接${realtime.connected ? '已连接' : '未连接，点击重连'}`"
      @click="reconnect"
    >
      <span
        class="container_appRealtimeBadge_dot"
        :class="{
          container_appRealtimeBadge_dot_connected: realtime.connected,
          container_appRealtimeBadge_dot_disconnected: !realtime.connected,
        }"
        aria-hidden="true"
      />
      {{ realtime.connected ? '实时' : '实时断开' }}
    </button>
  </div>
</template>

<script setup lang="ts">
// 实时连接状态：脉冲点 + 断线可点击手动重连（此前断开是静默的）
const realtime = useRealtimeStore()

const title = computed(() =>
  realtime.connected ? 'WebSocket 实时推送已连接，点击可重连' : '实时推送未连接，点击重连',
)

function reconnect() {
  if (realtime.connected) return
  realtime.disconnect()
  realtime.connect()
}
</script>

<style lang="scss" scoped>
.container_appRealtimeBadge_pill {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  height: $control-sm;
  padding: 0 $space-3;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: var(--tc-card-bg);
  color: $color-text-secondary;
  font-size: $font-xs;
  cursor: pointer;
  transition: border-color $dur-fast $ease-out, color $dur-fast $ease-out;

  &_disconnected {
    color: $color-alarm;

    &:hover {
      border-color: $color-alarm;
    }
  }
}

.container_appRealtimeBadge_dot {
  width: 8px;
  height: 8px;
  border-radius: $radius-pill;
  flex-shrink: 0;

  &_connected {
    background: $color-normal;
    animation: container_appRealtimeBadge_pulse 2s ease-in-out infinite;
  }

  &_disconnected {
    background: $color-alarm;
  }
}

@keyframes container_appRealtimeBadge_pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--tc-normal-soft);
  }

  50% {
    box-shadow: 0 0 0 4px var(--tc-normal-soft);
  }
}
</style>
