<template>
  <div ref="rootEl" class="container_appUserMenu">
    <button
      type="button"
      class="container_appUserMenu_trigger"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="menu"
      @click.stop="toggle"
    >
      <span class="container_appUserMenu_avatar" aria-hidden="true">{{ initial }}</span>
      <span class="container_appUserMenu_name">{{ auth.user?.username }}</span>
      <span class="container_appUserMenu_role" :class="auth.isAdmin ? 'container_appUserMenu_role_admin' : ''">
        {{ auth.user?.authType === 'apiKey' ? 'ApiKey' : auth.user?.role }}
      </span>
      <svg
        class="container_appUserMenu_caret"
        :class="{ container_appUserMenu_caret_open: open }"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        aria-hidden="true"
      >
        <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>

    <!-- 遮罩挂到 body：头部有 backdrop-filter，fixed 元素留在头部内只能覆盖头部区域；
         挂出去后遮罩位于 sticky 头部（$z-sticky）之下，拦截对页面内容的误点 -->
    <Teleport to="body">
      <Transition name="userMenu">
        <div
          v-if="open"
          class="container_appUserMenu_mask"
          @click.stop="close"
        />
      </Transition>
    </Teleport>

    <Transition name="userMenu">
      <div
        v-if="open"
        class="container_appUserMenu_menu"
        role="menu"
        @keydown.esc.stop.prevent="close"
      >
        <div class="container_appUserMenu_head">
          <span class="container_appUserMenu_head_name">{{ auth.user?.username }}</span>
          <UiBadge variant="primary" size="sm">{{ auth.user?.authType === 'apiKey' ? 'ApiKey 登录' : (auth.user?.role === 'admin' ? '管理员' : '只读') }}</UiBadge>
        </div>

        <button type="button" role="menuitem" class="container_appUserMenu_item" @click="switchTheme">
          <span aria-hidden="true" class="container_appUserMenu_item_icon">{{ theme.theme.value === 'dark' ? '☀' : '☾' }}</span>
          {{ theme.theme.value === 'dark' ? '切换亮色模式' : '切换暗色模式' }}
        </button>

        <div class="container_appUserMenu_sep" aria-hidden="true" />

        <button type="button" role="menuitem" class="container_appUserMenu_item container_appUserMenu_item_danger" @click="onLogout">
          <span aria-hidden="true" class="container_appUserMenu_item_icon">⎋</span>
          退出登录
        </button>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
// 用户菜单：用户名 + 角色 + 主题切换 + 退出（原先只有看板页有这些入口）
const auth = useAuthStore()
const realtime = useRealtimeStore()
const theme = useTheme()
const toast = useToast()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const initial = computed(() => (auth.user?.username ?? '?').slice(0, 1).toUpperCase())

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function switchTheme() {
  theme.toggle()
  close()
}

async function onLogout() {
  close()
  realtime.disconnect()
  await auth.logout()
  toast.info('已退出登录')
}

function onDocClick(e: MouseEvent) {
  if (!open.value) return
  if (rootEl.value?.contains(e.target as Node)) return
  close()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<style lang="scss" scoped>
.container_appUserMenu {
  position: relative;
}

.container_appUserMenu_trigger {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  height: $control-md;
  padding: 0 $space-2;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: var(--tc-hover);
  }
}

.container_appUserMenu_avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: $radius-pill;
  background: var(--tc-primary-soft);
  color: $color-primary;
  font-size: $font-xs;
  font-weight: 600;
  flex-shrink: 0;
}

.container_appUserMenu_name {
  font-size: $font-sm;
  color: $color-text;
  max-width: 96px;

  @include truncate;
}

.container_appUserMenu_role {
  font-size: $font-xs;
  color: $color-text-secondary;

  &_admin {
    color: $color-primary;
  }
}

.container_appUserMenu_caret {
  color: $color-text-secondary;
  transition: transform $dur-fast $ease-out;

  &_open {
    transform: rotate(180deg);
  }
}

.container_appUserMenu_mask {
  position: fixed;
  inset: 0;
  z-index: $z-sticky - 1;
}

.container_appUserMenu_menu {
  position: absolute;
  top: calc(100% + #{$space-2});
  right: 0;
  z-index: 1;
  min-width: 180px;
  background: var(--tc-card-bg);
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: var(--tc-shadow-2);
  padding: $space-2;
  transform-origin: top right;
}

// 进出场：淡入 + 轻微下移/缩放
.userMenu-enter-active,
.userMenu-leave-active {
  transition: opacity $dur-fast $ease-out, transform $dur-fast $ease-out;
}

.userMenu-enter-from,
.userMenu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.container_appUserMenu_mask.userMenu-enter-from,
.container_appUserMenu_mask.userMenu-leave-to {
  transform: none;
}

.container_appUserMenu_head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  padding: $space-2;
  margin-bottom: $space-1;
  border-bottom: 1px solid $color-border;
}

.container_appUserMenu_head_name {
  font-size: $font-sm;
  font-weight: 600;
  color: $color-text;
}

.container_appUserMenu_item {
  display: flex;
  align-items: center;
  gap: $space-2;
  width: 100%;
  padding: $space-2 $space-2;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: $color-text;
  font-size: $font-base;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--tc-hover);
  }
}

.container_appUserMenu_item_danger {
  color: $color-danger;

  &:hover {
    background: var(--tc-alarm-soft);
  }
}

.container_appUserMenu_item_icon {
  width: 16px;
  text-align: center;
  opacity: 0.8;
}

.container_appUserMenu_sep {
  height: 1px;
  margin: $space-1 0;
  background: $color-border;
}
</style>
