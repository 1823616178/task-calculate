<script setup lang="ts">
// 浏览器标签页标题：各页面 useHead({ title }) 提供页面名，此处统一拼上平台名
useHead({
  title: '数据检测汇总平台',
  titleTemplate: (title) => {
    const app = '数据检测汇总平台'
    if (!title || title === app) return app
    return `${title} · ${app}`
  },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
