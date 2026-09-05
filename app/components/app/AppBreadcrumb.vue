<template>
  <div :class="`container_appBreadcrumb_${items.length > 0 ? 'bar' : 'hidden'}`">
    <nav class="container_appBreadcrumb" aria-label="面包屑导航">
      <ol class="container_appBreadcrumb_list">
        <li v-for="(item, i) in items" :key="i" class="container_appBreadcrumb_item">
          <NuxtLink
            v-if="item.to && i < items.length - 1"
            :to="item.to"
            class="container_appBreadcrumb_link"
          >
            {{ item.label }}
          </NuxtLink>
          <span v-else class="container_appBreadcrumb_current" aria-current="page">
            {{ item.label }}
          </span>
          <span
            v-if="i < items.length - 1"
            class="container_appBreadcrumb_sep"
            aria-hidden="true"
          >/</span>
        </li>
      </ol>
    </nav>
  </div>
</template>

<script setup lang="ts">
export interface BreadcrumbItem {
  label: string
  to?: string
}

const props = defineProps<{ items: BreadcrumbItem[] }>()

// 无内容时不占位，避免二级页顶部出现空洞
const items = computed(() => props.items.filter(Boolean))
</script>

<style lang="scss" scoped>
.container_appBreadcrumb_hidden {
  display: none;
}

.container_appBreadcrumb {
  margin-bottom: $space-3;

  &_list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &_item {
    display: flex;
    align-items: center;
    gap: $space-2;
  }

  &_link {
    color: $color-text-secondary;
    font-size: $font-sm;

    &:hover {
      color: $color-primary;
    }
  }

  &_current {
    color: $color-text;
    font-size: $font-sm;
    font-weight: 500;
  }

  &_sep {
    color: var(--tc-border);
    user-select: none;
  }
}
</style>
