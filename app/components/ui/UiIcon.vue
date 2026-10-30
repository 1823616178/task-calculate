<template>
  <!-- 统一图标：此前 KPI / 徽标混用 ▦ ✓ ! ✕ 等字符，不同字体下渲染不一；
       这里用同一套描边 SVG，颜色跟随 currentColor。 -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    :width="size"
    :height="size"
  >
    <template v-if="name === 'grid'">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" />
    </template>
    <template v-else-if="name === 'check'">
      <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'warning'">
      <path d="M12 3 22 20H2L12 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M12 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" stroke-width="2" />
    </template>
    <template v-else-if="name === 'alarm'">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
      <path d="M12 7v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" stroke-width="2" />
    </template>
    <template v-else-if="name === 'arrow'">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'chevron'">
      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  name: 'grid' | 'check' | 'warning' | 'alarm' | 'arrow' | 'search' | 'chevron'
  size?: number | string
}>(), { size: 16 })
</script>
