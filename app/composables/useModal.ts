// 弹窗栈管理：多层弹窗的滚动锁定计数、ESC 关闭只作用于最顶层。
// 编程式使用：组件内 const modal = useModal(); modal.lockScroll() / unlockScroll()。

let lockCount = 0

const modalTokens: number[] = []
let tokenSeq = 0

export interface ModalHandle {
  /** 进入弹窗：锁滚动并注册层级（返回离开函数） */
  enter(): () => void
  /** 是否为当前最顶层弹窗（决定 ESC 归属） */
  isTopmost(): boolean
}

export function useModal(): ModalHandle {
  const token = ++tokenSeq

  function lockScroll() {
    if (!import.meta.client) return
    lockCount += 1
    document.body.classList.add('tc-scroll-lock')
  }

  function unlockScroll() {
    if (!import.meta.client) return
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) document.body.classList.remove('tc-scroll-lock')
  }

  return {
    enter() {
      modalTokens.push(token)
      lockScroll()
      return () => {
        const i = modalTokens.indexOf(token)
        if (i >= 0) modalTokens.splice(i, 1)
        unlockScroll()
      }
    },
    isTopmost() {
      if (!import.meta.client) return true
      return modalTokens[modalTokens.length - 1] === token
    },
  }
}

// 焦点陷阱：把 Tab 循环限制在容器内的可聚焦元素上
const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function trapTabKey(event: KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter(el => el.offsetParent !== null)
  if (items.length === 0) {
    event.preventDefault()
    container.focus()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) {
    event.preventDefault()
    container.focus()
    return
  }
  const active = document.activeElement as HTMLElement | null

  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

export function getFirstFocusable(container: HTMLElement | null): HTMLElement | null {
  if (!container) return null
  const autofocused = container.querySelector<HTMLElement>('[data-autofocus]')
  if (autofocused) return autofocused
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter(el => el.offsetParent !== null)
  return items[0] ?? null
}
