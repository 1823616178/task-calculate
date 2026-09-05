<template>
  <span class="container_uiCopy">
    <code v-if="display" class="container_uiCopy_text">{{ display }}</code>
    <button
      type="button"
      class="container_uiCopy_btn"
      :class="{ container_uiCopy_btn_copied: copied }"
      :aria-label="copied ? '已复制' : '复制到剪贴板'"
      :title="copied ? '已复制' : '复制'"
      @click="copy"
    >
      <svg
        v-if="!copied"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.8" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8" />
      </svg>
      <svg
        v-else
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 12.5l5.2 5L20 6.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </span>
</template>

<script setup lang="ts">
// 一键复制：ApiKey、Webhook 地址等；成功后图标切换 + toast 反馈
const props = withDefaults(defineProps<{
  text: string
  display?: string
}>(), { display: '' })

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  const ok = await copyToClipboard(props.text)
  if (!ok) return
  copied.value = true
  useToast().success('已复制到剪贴板', 1600)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
    timer = null
  }, 1600)
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function copyToClipboard(text: string): Promise<boolean> {
  if (import.meta.server || !text) return Promise.resolve(false)
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallbackCopy(text),
    )
  }
  return Promise.resolve(fallbackCopy(text))
}

// http 环境（内网部署）没有 clipboard API 时走 execCommand 兜底
function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
</script>

<style lang="scss" scoped>
.container_uiCopy {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  min-width: 0;
  max-width: 100%;
}

.container_uiCopy_text {
  max-width: 100%;

  @include truncate;
}

.container_uiCopy_btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $color-text-secondary;
  cursor: pointer;

  &:hover {
    background: var(--tc-hover);
    color: $color-text;
  }
}

.container_uiCopy_btn_copied {
  color: $color-normal;
}
</style>
