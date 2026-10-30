<template>
  <UiModal
    :model-value="visible"
    size="sm"
    title="新建用户"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div class="container_userFormModal_form">
      <UiField label="用户名" required>
        <UiInput
          v-model="form.username"
          data-autofocus
          placeholder="登录用户名"
          autocomplete="off"
          :invalid="!!errors.username"
        />
      </UiField>
      <p v-if="errors.username" class="container_userFormModal_error" role="alert">{{ errors.username }}</p>

      <UiField label="密码" required hint="至少 6 位">
        <UiInput
          v-model="form.password"
          type="password"
          placeholder="登录密码"
          autocomplete="new-password"
          :invalid="!!errors.password"
        />
      </UiField>
      <div class="container_userFormModal_strength" aria-hidden="true">
        <span
          v-for="i in 3"
          :key="i"
          class="container_userFormModal_strengthSeg"
          :class="{ container_userFormModal_strengthSeg_on: strength >= i }"
        />
        <span class="container_userFormModal_strengthText">{{ STRENGTH_TEXT[strength] }}</span>
      </div>
      <p v-if="errors.password" class="container_userFormModal_error" role="alert">{{ errors.password }}</p>

      <UiField label="角色" required hint="viewer 为只读，admin 可管理全部配置">
        <UiSelect v-model="form.role">
          <option value="viewer">viewer（只读）</option>
          <option value="admin">admin（管理员）</option>
        </UiSelect>
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="secondary" @click="emit('update:visible', false)">取消</UiButton>
      <UiButton variant="primary" :loading="submitting" @click="submit">创建</UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
// 新建用户弹窗：用户名/密码/角色，带长度校验与简单强度指示
const props = defineProps<{ visible: boolean }>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: []
}>()

const toast = useToast()

const form = reactive({
  username: '',
  password: '',
  role: 'viewer' as 'admin' | 'viewer',
})
const errors = reactive<{ username?: string, password?: string }>({})
const submitting = ref(false)

watch(() => props.visible, (v) => {
  if (!v) return
  Object.assign(form, { username: '', password: '', role: 'viewer' })
  errors.username = undefined
  errors.password = undefined
})

// 强度：1=长度足够 / 2=混合字母数字 / 3=再含符号或大小写
const strength = computed(() => {
  const p = form.password
  let s = 0
  if (p.length >= 6) s = 1
  else return 0
  const hasDigit = /\d/.test(p)
  const hasAlpha = /[a-zA-Z]/.test(p)
  const hasOther = p.length > (hasDigit ? 0 : -1) && !/^[\da-zA-Z]*$/.test(p)
  if (hasDigit && hasAlpha) s = 2
  if (s === 2 && (hasOther || /[a-z]/.test(p) !== /[A-Z]/.test(p))) s = 3
  return s
})

const STRENGTH_TEXT = ['', '弱', '中', '强']

async function submit() {
  errors.username = ''
  errors.password = ''
  let ok = true
  if (!form.username.trim()) {
    errors.username = '请填写用户名'
    ok = false
  }
  if (form.password.length < 6) {
    errors.password = '密码至少 6 位'
    ok = false
  }
  if (!ok) return

  submitting.value = true
  try {
    await $fetch('/api/users', {
      method: 'POST',
      body: {
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      },
    })
    toast.success(`用户「${form.username.trim()}」已创建`)
    emit('saved')
    emit('update:visible', false)
  } catch (err) {
    toast.error(errorMessage(err, '创建失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container_userFormModal_form {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.container_userFormModal_error {
  margin: -10px 0 0;
  color: $color-danger;
  font-size: $font-xs;
}

.container_userFormModal_strength {
  display: flex;
  align-items: center;
  gap: $space-1;
  margin-top: -8px;
}

.container_userFormModal_strengthSeg {
  height: 4px;
  flex: 0 0 28px;
  border-radius: $radius-pill;
  background: var(--tc-hover);

  &_on:nth-child(1) { background: $color-danger; }
  &_on:nth-child(2) { background: var(--tc-warning); }
  &_on:nth-child(3) { background: $color-normal; }
}

.container_userFormModal_strengthText {
  margin-left: $space-2;
  font-size: $font-xs;
  color: $color-text-secondary;
}
</style>
