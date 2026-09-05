// 主题切换：localStorage 持久化，html[data-theme] 驱动 CSS 变量
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tc_theme'

function apply(theme: Theme): void {
  if (typeof document === 'undefined') return
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
}

export function useTheme() {
  const theme = useState<Theme>('tc-theme', () => 'light')

  // 首次客户端渲染时同步（SSR 阶段由 nuxt.config 的内联脚本提前应用，避免闪烁）
  function init() {
    if (!import.meta.client) return
    const saved = localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
    theme.value = saved
    apply(saved)
  }

  function toggle() {
    const next: Theme = theme.value === 'dark' ? 'light' : 'dark'
    theme.value = next
    apply(next)
    if (import.meta.client) localStorage.setItem(STORAGE_KEY, next)
  }

  return { theme, init, toggle }
}
