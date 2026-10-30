<template>
  <div class="container_login">
    <!-- 背景光斑：缓慢呼吸，不抢视线 -->
    <div class="container_login_glow container_login_glow_a" aria-hidden="true" />
    <div class="container_login_glow container_login_glow_b" aria-hidden="true" />

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

      <div class="container_login_modes" role="tablist" aria-label="登录方式">
        <button type="button" :class="{ active: mode === 'password' }" @click="mode = 'password'">账号密码</button>
        <button type="button" :class="{ active: mode === 'apiKey' }" @click="mode = 'apiKey'">ApiKey</button>
      </div>

      <UiField v-if="mode === 'password'" label="用户名" required>
        <UiInput
          ref="usernameInput"
          v-model="username"
          placeholder="用户名"
          autocomplete="username"
          size="lg"
          :disabled="loading"
        />
      </UiField>

      <UiField v-if="mode === 'password'" label="密码" required>
        <UiInput
          ref="passwordInput"
          v-model="password"
          type="password"
          placeholder="密码"
          autocomplete="current-password"
          size="lg"
          :disabled="loading"
        />
      </UiField>

      <UiField v-else label="ApiKey" required hint="登录后仅能使用该 Key 已授权的功能和系统">
        <UiInput
          ref="apiKeyInput"
          v-model="apiKey"
          type="password"
          placeholder="dk_..."
          autocomplete="off"
          size="lg"
          :disabled="loading"
        />
      </UiField>

      <Transition name="loginError">
        <p v-if="error" class="container_login_error" role="alert">
          <span class="container_login_errorIcon" aria-hidden="true">!</span>{{ error }}
        </p>
      </Transition>

      <label v-if="mode === 'password'" class="container_login_remember">
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
import type { ComponentPublicInstance } from 'vue'

const auth = useAuthStore()
const theme = useTheme()

definePageMeta({ layout: 'blank' })

useHead({ title: '登录' })

const REMEMBER_KEY = 'tc_login_username'

const username = ref('')
const password = ref('')
const apiKey = ref('')
const mode = ref<'password' | 'apiKey'>('password')
const remember = ref(true)
const loading = ref(false)
const error = ref('')

const usernameInput = ref<ComponentPublicInstance | null>(null)
const passwordInput = ref<ComponentPublicInstance | null>(null)
const apiKeyInput = ref<ComponentPublicInstance | null>(null)

function focusInput(host: ComponentPublicInstance | null) {
  const el = host?.$el as HTMLElement | undefined
  el?.querySelector('input')?.focus()
}

// 记住的用户名已填好时，光标直接落到密码框
function focusFirstEmpty() {
  focusInput(mode.value === 'apiKey' ? apiKeyInput.value : (username.value ? passwordInput.value : usernameInput.value))
}

watch(mode, () => void nextTick(focusFirstEmpty))

onMounted(() => {
  theme.init()
  try {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) username.value = saved
  } catch {
    // localStorage 不可用时忽略（隐私模式等）
  }
  void nextTick(focusFirstEmpty)
})

async function onSubmit() {
  if (loading.value) return
  error.value = ''
  if (mode.value === 'password' && (!username.value.trim() || !password.value)) {
    error.value = '请输入用户名与密码'
    return
  }
  if (mode.value === 'apiKey' && !apiKey.value.trim()) {
    error.value = '请输入 ApiKey'
    return
  }
  loading.value = true
  try {
    if (mode.value === 'apiKey') await auth.loginWithApiKey(apiKey.value.trim())
    else await auth.login(username.value.trim(), password.value)
    if (mode.value === 'password' && remember.value) {
      try {
        localStorage.setItem(REMEMBER_KEY, username.value.trim())
      } catch { /* 忽略 */ }
    } else if (mode.value === 'password') {
      try {
        localStorage.removeItem(REMEMBER_KEY)
      } catch { /* 忽略 */ }
    }
    await navigateTo('/')
  } catch (err) {
    const e = err as { data?: { statusMessage?: string, message?: string } }
    error.value = e.data?.statusMessage || e.data?.message || '登录失败'
    if (mode.value === 'password') password.value = ''
    else apiKey.value = ''
    void nextTick(focusFirstEmpty)
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.container_login {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space-4;
  overflow: hidden;
  background: $color-bg;
}

// 背景光斑：极缓慢漂移，营造"活着"的观感
.container_login_glow {
  position: absolute;
  width: 46vmax;
  height: 46vmax;
  border-radius: 50%;
  background: var(--tc-primary-soft);
  filter: blur(20px);
  pointer-events: none;
}

.container_login_glow_a {
  top: -14vmax;
  left: -10vmax;
  animation: container_login_drift 18s $ease-out infinite alternate;
}

.container_login_glow_b {
  right: -12vmax;
  bottom: -16vmax;
  animation: container_login_drift 22s $ease-out infinite alternate-reverse;
}

@keyframes container_login_drift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.75;
  }

  to {
    transform: translate3d(4vmax, 3vmax, 0) scale(1.12);
    opacity: 1;
  }
}

.container_login_form {
  @include card($padding: $space-6);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: $space-4;
  width: min(360px, 100%);
  box-shadow: var(--tc-shadow-2);
  animation: container_login_in 0.42s $ease-out both;
}

.container_login_modes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 2px;
  border-radius: $radius-md;
  background: var(--tc-hover);

  button {
    height: $control-md;
    border: 0;
    border-radius: $radius-sm;
    color: $color-text-secondary;
    background: transparent;
    cursor: pointer;
  }

  button.active {
    color: $color-primary;
    background: var(--tc-card-bg);
    box-shadow: var(--tc-shadow-1);
  }
}

@keyframes container_login_in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: none;
  }
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
  // 折线自绘：进场时描边一次
  animation: container_login_pop 0.5s $ease-out 0.1s both;
}

@keyframes container_login_pop {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.9);
  }

  to {
    opacity: 1;
    transform: none;
  }
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
  display: flex;
  align-items: center;
  gap: $space-2;
  margin: 0;
  padding: $space-2 $space-3;
  border-radius: $radius-md;
  background: var(--tc-alarm-soft);
  color: $color-danger;
  font-size: $font-sm;
}

.container_login_errorIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: $radius-pill;
  background: $color-danger;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

// 错误提示进出场（登录失败时轻微抖动，提示更明确）
.loginError-enter-active {
  animation: container_login_shake 0.32s $ease-out;
}

.loginError-leave-active {
  transition: opacity $dur-fast $ease-out;
}

.loginError-leave-to {
  opacity: 0;
}

@keyframes container_login_shake {
  0% {
    opacity: 0;
    transform: translateX(0);
  }

  30% {
    opacity: 1;
    transform: translateX(-5px);
  }

  60% {
    transform: translateX(4px);
  }

  100% {
    opacity: 1;
    transform: none;
  }
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
