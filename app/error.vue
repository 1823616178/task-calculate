<template>
  <div class="container_errorPage">
    <div class="container_errorPage_card">
      <p class="container_errorPage_code">{{ error.statusCode }}</p>
      <h1 class="container_errorPage_title">{{ title }}</h1>
      <p v-if="detail" class="container_errorPage_detail">{{ detail }}</p>
      <div class="container_errorPage_actions">
        <UiButton variant="primary" @click="goHome">返回看板</UiButton>
        <UiButton variant="secondary" @click="goBack">返回上一页</UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

// 统一错误页（404 / 500 / 运行时错误），替代 Nuxt 默认错误页
const props = defineProps<{ error: NuxtError }>()

const title = computed(() => {
  if (props.error.statusCode === 404) return '页面不存在'
  if (props.error.statusCode === 403) return '没有访问权限'
  return '出错了'
})

const detail = computed(() => {
  if (props.error.statusCode === 404) return '你访问的页面不存在或已被移除。'
  return props.error.statusMessage || props.error.message || '发生了意外错误，请稍后重试。'
})

function goHome() {
  clearError({ redirect: '/' })
}

function goBack() {
  clearError()
}
</script>

<style lang="scss" scoped>
.container_errorPage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space-4;
  background:
    radial-gradient(circle at 15% 20%, var(--tc-primary-soft), transparent 45%),
    var(--tc-bg);
}

.container_errorPage_card {
  @include card($padding: $space-8);

  max-width: 420px;
  text-align: center;
  box-shadow: var(--tc-shadow-2);
}

.container_errorPage_code {
  margin: 0;
  font-size: $font-2xl;
  font-weight: 700;
  color: $color-primary;
  line-height: 1.2;
}

.container_errorPage_title {
  margin: $space-2 0;
  font-size: $font-xl;
}

.container_errorPage_detail {
  margin: 0 0 $space-5;
  color: $color-text-secondary;
  font-size: $font-base;
  word-break: break-all;
}

.container_errorPage_actions {
  display: flex;
  justify-content: center;
  gap: $space-3;
  flex-wrap: wrap;
}
</style>
