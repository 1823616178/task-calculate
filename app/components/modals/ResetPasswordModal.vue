<template>
  <UiModal
    :model-value="visible"
    size="sm"
    :title="`重置密码 — ${user?.username ?? ''}`"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div class="container_resetPasswordModal_form">
      <UiField label="新密码" required hint="至少 6 位">
        <UiInput
          v-model="password"
          type="password"
          data-autofocus
          autocomplete="new-password"
          placeholder="输入新密码"
          :invalid="!!error && password.length > 0 && password.length < MIN_LEN"
        />
      </UiField>

      <UiField label="确认新密码" required>
        <UiInput
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="再次输入新密码"
          @enter.prevent="submit"
        />
      </UiField>

      <p v-if="error" class="container_resetPasswordModal_error" role="alert">{{ error }}</p>
    </div>

    <template #footer>
      <UiButton variant="secondary" @click="emit('update:visible', false)">取消</UiButton>
      <UiButton variant="primary" :loading="submitting" @click="submit">重置</UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import type { UserDto } from '../../types'

// 重置密码弹窗：取代此前的浏览器原生输入弹窗（明文可见、无二次确认）
const props = defineProps<{
  visible: boolean
  user?: UserDto | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: []
}>()

const toast = useToast()

const MIN_LEN = 6

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const submitting = ref(false)

watch(() => props.visible, (v) => {
  if (!v) return
  password.value = ''
  confirmPassword.value = ''
  error.value = ''
})

async function submit() {
  error.value = ''
  if (password.value.length < MIN_LEN) {
    error.value = '密码至少 6 位'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }

  submitting.value = true
  try {
    if (props.user) {
      await $fetch(`/api/users/${props.user.id}`, {
        method: 'PUT',
        body: { password: password.value },
      })
    }
    toast.success(`已为「${props.user?.username}」重置密码`)
    emit('saved')
    emit('update:visible', false)
  } catch (err) {
    error.value = errorMessage(err, '重置失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container_resetPasswordModal_form {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.container_resetPasswordModal_error {
  margin: -$space-1 0 0;
  color: $color-danger;
  font-size: $font-xs;
}
</style>
