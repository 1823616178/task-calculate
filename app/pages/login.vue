<template>
  <div class="container_login">
    <form class="container_login_form" @submit.prevent="onSubmit">
      <div class="container_login_brand">
        <svg class="container_login_logo" viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--tc-primary)" opacity="0.16" />
          <polyline
            points="6,14 10,8 13,12.5 18,6"
            fill="none"
            stroke="var(--tc-primary)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="18" cy="6" r="1.8" fill="var(--tc-primary)" />
        </svg>
        <h1 class="container_login_title">数据检测汇总平台</h1>
        <p class="container_login_slogan">指标上报 · 阈值判定 · 告警通知，一站式掌握产线状态</p>
      </div>

      <UiField label="用户名" required>
        <UiInput
          v-model="username"
          data-autofocus
          placeholder="用户名"
          autocomplete="username"
          size="lg"
        />
      </UiField>

      <UiField label="密码" required>
        <UiInput
          v-model="password"
          type="password"
          placeholder="密码"
          autocomplete="current-password"
          size="lg"
        />
      </UiField>

      <p v-if="error" class="container_login_error" role="alert">{{ error }}</p>

      <label class="container_login_remember">
        <input v-model="remember" type="checkbox"> 记住用户名
      </label>

      <UiButton
        variant="primary"
        size="lg"
        block
        type="submit"
        :loading="loading"
      >
        {{ loading ? '登录中…' : '登录' }}
      </UiButton>
    </form>
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const theme = useTheme()

definePageMeta({ layout: 'blank' })

const REMEMBER_KEY = 'tc_login_username'

const username = ref('')
const password = ref('')
const remember = ref(true)
const loading = ref(false)
const error = ref('')

onMounted(() => {
  theme.init()
  try {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) username.value = saved
  } catch {
    // localStorage 不可用时忽略（隐私模式等）
  }
})

async function onSubmit() {
  if (loading.value) return
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名与密码'
    return
  }
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    if (remember.value) {
      try {
        localStorage.setItem(REMEMBER_KEY, username.value.trim())
      } catch { /* 忽略 */ }
    } else {
      try {
        localStorage.removeItem(REMEMBER_KEY)
      } catch { /* 忽略 */ }
    }
    await navigateTo('/')
  } catch (err) {
    const e = err as { data?: { statusMessage?: string, message?: string } }
    error.value = e.data?.statusMessage || e.data?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.container_login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space-4;
  background:
    radial-gradient(circle at 15% 15%, var(--tc-primary-soft), transparent 42%),
    radial-gradient(circle at 85% 85%, var(--tc-primary-soft), transparent 40%),
    var(--tc-bg);
}

.container_login_form {
  @include card($padding: $space-6);

  display: flex;
  flex-direction: column;
  gap: $space-4;
  width: min(360px, 100%);
  box-shadow: var(--tc-shadow-2);
}

.container_login_brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: $space-2;
}

.container_login_logo {
  margin-bottom: $space-3;
}

.container_login_title {
  margin: 0;
  font-size: $font-xl;
}

.container_login_slogan {
  margin: $space-1 0 0;
  color: $color-text-secondary;
  font-size: $font-xs;
}

.container_login_error {
  margin: 0;
  padding: $space-2 $space-3;
  border-radius: $radius-md;
  background: var(--tc-alarm-soft);
  color: $color-danger;
  font-size: $font-sm;
}

.container_login_remember {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-size: $font-sm;
  color: $color-text-secondary;
  cursor: pointer;

  input {
    accent-color: var(--tc-primary);
  }

  &:has(input:focus-visible) {
    outline: 2px solid var(--tc-focus-ring);
    outline-offset: 2px;
  }
}
</style>
