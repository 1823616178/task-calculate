<template>
  <div class="container_apiKeysPage">
    <UiPageHead
      title="ApiKey 管理"
      description="统一创建和管理平台访问凭证，并为每个 Key 分配功能权限与系统范围"
    />
    <ApiKeyManager />
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'ApiKey 管理' })
definePageMeta({ middleware: 'admin' })
</script>

<style lang="scss" scoped>
.container_apiKeysPage {
  max-width: 1400px;
  margin: 0 auto;
  padding: $space-5 $space-4 $space-6;
}
</style>
