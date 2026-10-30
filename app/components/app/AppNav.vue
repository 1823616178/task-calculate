<template>
  <nav :class="`container_appNav_${open ? 'open' : 'closed'}`" aria-label="主导航">
    <ul class="container_appNav_list">
      <li v-for="item in commonItems" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="container_appNav_link"
          :class="{ container_appNav_link_active: isActive(item.to) }"
          @click="emit('navigate')"
        >
          {{ item.label }}
        </NuxtLink>
      </li>

      <template v-if="visibleAdminItems.length > 0">
        <li class="container_appNav_adminGroup" aria-hidden="true" />
        <li v-for="item in visibleAdminItems" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="container_appNav_link container_appNav_link_admin"
            :class="{ container_appNav_link_active: isActive(item.to) }"
            @click="emit('navigate')"
          >
            {{ item.label }}
          </NuxtLink>
        </li>
      </template>
    </ul>
  </nav>
</template>

<script setup lang="ts">
// 主导航：桌面横排 / 窄屏抽屉。
// admin 分组用竖分隔线 + 淡底色区隔；非 admin 直接不渲染（而非渲染后跳走）。
const props = defineProps<{ open?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const auth = useAuthStore()

const commonItems = [
  { to: '/', label: '看板' },
  { to: '/systems', label: '系统' },
  { to: '/records', label: '历史记录' },
  { to: '/api-docs', label: 'API' },
]

const adminItems = [
  { to: '/api-keys', label: 'ApiKey', permission: 'apiKeys:manage' as const },
  { to: '/channels', label: '通知渠道', permission: 'alerts:manage' as const },
  { to: '/users', label: '用户', permission: 'users:manage' as const },
  { to: '/audit', label: '审计', permission: 'audit:read' as const },
]
const visibleAdminItems = computed(() => adminItems.filter(item => auth.can(item.permission)))

function isActive(href: string): boolean {
  // /systems/* 归入"系统"；首页要求精确匹配
  if (href === '/') return route.path === '/'
  return route.path === href || route.path.startsWith(`${href}/`)
}

const open = computed(() => props.open ?? false)
</script>

<style lang="scss" scoped>
.container_appNav_list {
  display: flex;
  align-items: center;
  gap: $space-1;
  margin: 0;
  padding: 0;
  list-style: none;
}

.container_appNav_link {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: $control-md;
  padding: 0 $space-3;
  border-radius: $radius-md;
  color: $color-text-secondary;
  font-size: $font-base;
  transition: color $dur-fast $ease-out, background-color $dur-fast $ease-out;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: $color-text;
    background: var(--tc-hover);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tc-focus-ring);
  }

  // 选中项下划线：随激活状态展开
  &::after {
    content: '';
    position: absolute;
    left: $space-3;
    right: $space-3;
    bottom: 3px;
    height: 2px;
    border-radius: $radius-pill;
    background: currentcolor;
    transform: scaleX(0);
    transform-origin: center;
    transition: transform $dur-base $ease-out;
  }
}

.container_appNav_link_active {
  color: $color-primary;
  font-weight: 500;
  background: var(--tc-active);

  &::after {
    transform: scaleX(1);
  }
}

// admin 分组：竖分隔线 + 淡底色，视觉上与全员入口区隔
.container_appNav_adminGroup {
  width: 1px;
  height: 18px;
  margin: 0 $space-2;
  background: $color-border;
}

@include down('md') {
  .container_appNav_closed {
    display: none;
  }

  // 抽屉态：贴顶栏下方的全宽面板
  .container_appNav_open {
    position: fixed;
    top: 56px;
    left: 0;
    right: 0;
    z-index: $z-dropdown;
    background: var(--tc-card-bg);
    border-bottom: 1px solid $color-border;
    box-shadow: var(--tc-shadow-2);
    padding: $space-2 $space-4 $space-3;

    .container_appNav_list {
      flex-direction: column;
      align-items: stretch;
      gap: $space-1;
    }

    .container_appNav_link {
      width: 100%;
      height: $control-lg;

      &::after {
        content: none;
      }
    }

    .container_appNav_adminGroup {
      width: auto;
      height: 1px;
      margin: $space-2 0;
    }
  }
}
</style>
