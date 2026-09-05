<template>
  <UiModal
    v-for="(item, index) in queue"
    v-show="index === queue.length - 1"
    :key="item.id"
    :model-value="true"
    size="sm"
    :close-on-mask="!item.requireText"
    @update:model-value="(v: boolean) => resolve(item, v)"
  >
    <template #title>
      <span
        class="container_uiConfirmHost_title"
        :class="{ container_uiConfirmHost_title_danger: item.danger }"
      >
        {{ item.title }}
      </span>
    </template>

    <div class="container_uiConfirmHost_body">
      <p v-if="item.message" class="container_uiConfirmHost_message">{{ item.message }}</p>

      <UiField
        v-if="item.requireText"
        :label="`请输入「${item.requireText}」以确认`"
        required
        :error="typed !== item.requireText && typed ? '输入内容不匹配' : ''"
      >
        <UiInput
          v-model="typed"
          data-autofocus
          class="container_uiConfirmHost_input"
          placeholder="输入确认文本"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="secondary" size="md" @click="resolve(item, false)">
        {{ item.cancelText || '取消' }}
      </UiButton>
      <button
        type="button"
        class="container_uiConfirmHost_ok"
        :class="[item.danger ? 'container_uiConfirmHost_ok_danger' : 'container_uiConfirmHost_ok_primary']"
        :disabled="!!item.requireText && typed !== item.requireText"
        @click="resolve(item, true)"
      >
        {{ item.confirmText || (item.danger ? '删除' : '确定') }}
      </button>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
// 确认框宿主：消费 useConfirm 队列（同一时刻只显示最新一项）。
// danger 变体红色按钮；requireText 强确认需输入匹配文本才能提交。

interface ConfirmItem {
  id: number
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  requireText?: string
}

const queue = useConfirmQueue()
const typed = ref('')

watch(() => queue.length, () => {
  typed.value = ''
})

function resolve(item: ConfirmItem, ok: boolean) {
  // 强确认项点遮罩/X 一律视为取消
  _resolveConfirm(item.id, ok)
}
</script>

<style lang="scss" scoped>
.container_uiConfirmHost_title {
  &.container_uiConfirmHost_title_danger {
    color: $color-danger;
  }
}

.container_uiConfirmHost_body {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.container_uiConfirmHost_message {
  margin: 0;
  color: $color-text;
  font-size: $font-base;
  line-height: 1.6;
  word-break: break-word;
}

.container_uiConfirmHost_input {
  width: 100%;
}

.container_uiConfirmHost_ok {
  height: $control-md;
  padding: 0 $space-4;
  border: none;
  border-radius: $radius-md;
  color: #fff;
  font-size: $font-base;
  cursor: pointer;
  transition: filter $dur-fast ease, opacity $dur-fast ease;

  &_primary { background: $color-primary; }

  &_danger { background: $color-danger; }

  &:hover:not(:disabled) { filter: brightness(0.92); }

  &_disabled,
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
