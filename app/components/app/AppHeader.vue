<template>
  <header class="container_appHeader">
    <div class="container_appHeader_inner">
      <div class="container_appHeader_left">
        <button
          type="button"
          class="container_appHeader_burger"
          :aria-expanded="navOpen ? 'true' : 'false'"
          aria-label="打开导航菜单"
          @click="navOpen = !navOpen"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <NuxtLink to="/" class="container_appHeader_brand" @click="navOpen = false">
          <svg class="container_appHeader_logo" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--tc-primary)" opacity="0.16" />
            <polyline
              points="6,14 10,8 13,12.5 18,6"
              fill="none"
              stroke="var(--tc-primary)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="18" cy="6" r="1.8" fill="var(--tc-primary)" />
          </svg>
          <span class="container_appHeader_title">数据检测汇总</span>
        </NuxtLink>

        <div class="container_appHeader_nav">
          <AppNav :open="false" />
        </div>
      </div>

      <div class="container_appHeader_tools">
        <div class="container_appHeader_toolRealtime"><AppRealtimeBadge /></div>
        <UiButton
          variant="ghost"
          size="sm"
          square
          :aria-label="theme.theme.value === 'dark' ? '切换亮色模式' : '切换暗色模式'"
          :title="theme.theme.value === 'dark' ? '切换亮色模式' : '切换暗色模式'"
          @click="theme.toggle()"
        >
          {{ theme.theme.value === 'dark' ? '☀' : '☾' }}
        </UiButton>
        <AppUserMenu />
      </div>
    </div>

    <!-- 窄屏抽屉 -->
    <AppNav
      v-if="navOpen"
      class="container_appHeader_drawer"
      :open="true"
      @navigate="navOpen = false"
    />
  </header>
</template>

<script setup lang="ts">
// 应用主框架顶栏：品牌 + 主导航 + 工具区（实时状态 / 主题 / 用户菜单）。
// 主题初始化与 realtime 连接提升到 layout，页面间切换不再反复建连/断连。
const theme = useTheme()
const navOpen = ref(false)

const route = useRoute()
watch(() => route.path, () => {
  navOpen.value = false
})
</script>

<style lang="scss" scoped>
.container_appHeader {
  position: sticky;
  top: 0;
  z-index: $z-sticky;
  background: var(--tc-header-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid $color-border;
}

.container_appHeader_inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  max-width: 1440px;
  height: 56px;
  margin: 0 auto;
  padding: 0 $space-4;
}

.container_appHeader_left {
  display: flex;
  align-items: center;
  gap: $space-3;
  min-width: 0;
}

.container_appHeader_burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: $control-lg;
  height: $control-lg;
  padding: 0 $space-2;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  cursor: pointer;

  span {
    display: block;
    height: 2px;
    border-radius: 999px;
    background: $color-text;
  }
}

.container_appHeader_brand {
  display: flex;
  align-items: center;
  gap: $space-2;
  color: $color-text;

  &:hover .container_appHeader_title {
    color: $color-primary;
  }
}

.container_appHeader_logo {
  flex-shrink: 0;
}

.container_appHeader_title {
  font-size: $font-lg;
  font-weight: 600;
  white-space: nowrap;
}

.container_appHeader_nav {
  display: block;
}

.container_appHeader_tools {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-shrink: 0;
}

@include down('lg') {
  .container_appHeader_title {
    display: none;
  }
}

@include down('md') {
  .container_appHeader_burger {
    display: flex;
  }

  .container_appHeader_nav,
  .container_appHeader_toolRealtime {
    display: none;
  }
}
</style>
