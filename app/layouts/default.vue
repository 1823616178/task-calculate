<template>
  <div class="container_appLayout">
    <AppHeader />
    <main class="container_appLayout_main">
      <slot />
    </main>
    <UiToastHost />
    <UiConfirmHost />
  </div>
</template>

<script setup lang="ts">
// 应用主框架（除 login / error 外全部页面）：
// - useTheme().init() 在这里执行，保证任意页面进入主题都生效（原先只在看板页）
// - realtime.connect() 提升到布局层，页面切换不反复建连/断连
const theme = useTheme()
const realtime = useRealtimeStore()

onMounted(() => {
  theme.init()
  realtime.connect()
})
</script>

<style lang="scss" scoped>
.container_appLayout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.container_appLayout_main {
  flex: 1;
  width: 100%;
}
</style>
