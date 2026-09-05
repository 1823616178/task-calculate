<template>
  <div class="container_appBlank">
    <slot />
  </div>
</template>

<script setup lang="ts">
// 极简布局：login / 错误页等无需导航框架的页面使用
</script>

<style lang="scss" scoped>
.container_appBlank {
  min-height: 100vh;
}
</style>
