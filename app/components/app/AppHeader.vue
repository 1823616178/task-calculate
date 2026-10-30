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
          icon-only
          :aria-label="theme.theme.value === 'dark' ? '切换亮色模式' : '切换暗色模式'"
          :title="theme.theme.value === 'dark' ? '切换亮色模式' : '切换暗色模式'"
          @click="theme.toggle()"
        >
          <!-- 日/月图标交叉旋转切换 -->
          <span class="container_appHeader_themeIcon" :class="{ container_appHeader_themeIcon_dark: theme.theme.value === 'dark' }">
            <svg class="container_appHeader_sun" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" />
              <path
                d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <svg class="container_appHeader_moon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </UiButton>
        <AppUserMenu />
      </div>
    </div>

    <!-- 窄屏抽屉 -->
    <Transition name="drawer">
      <AppNav
        v-if="navOpen"
        class="container_appHeader_drawer"
        :open="true"
        @navigate="navOpen = false"
      />
    </Transition>
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
  gap: $space-1;
  width: $control-lg;
  height: $control-lg;
  padding: 0 $space-2;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  cursor: pointer;
  transition: background-color $dur-fast $ease-out;

  &:hover {
    background: var(--tc-hover);
  }

  span {
    display: block;
    height: 2px;
    border-radius: $radius-pill;
    background: $color-text;
    transition: transform $dur-base $ease-out, opacity $dur-fast $ease-out;
  }

  // 展开态：三条杠收成叉
  &[aria-expanded='true'] span:nth-child(1) {
    transform: translateY(6px) rotate(45deg);
  }

  &[aria-expanded='true'] span:nth-child(2) {
    opacity: 0;
  }

  &[aria-expanded='true'] span:nth-child(3) {
    transform: translateY(-6px) rotate(-45deg);
  }
}

// 抽屉滑入/滑出
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity $dur-base $ease-out, transform $dur-base $ease-out;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: translateY(-8px);
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
  transition: transform $dur-slow $ease-spring;
}

.container_appHeader_brand:hover .container_appHeader_logo {
  transform: rotate(-8deg) scale(1.08);
}

// 主题图标：亮色显示月亮（点击切暗），暗色显示太阳
.container_appHeader_themeIcon {
  position: relative;
  display: inline-block;
  width: 16px;
  height: 16px;

  svg {
    position: absolute;
    inset: 0;
    transition: transform $dur-slow $ease-out, opacity $dur-base $ease-out;
  }
}

.container_appHeader_sun {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.container_appHeader_themeIcon_dark {
  .container_appHeader_sun {
    opacity: 1;
    transform: none;
  }

  .container_appHeader_moon {
    opacity: 0;
    transform: rotate(90deg) scale(0.5);
  }
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
