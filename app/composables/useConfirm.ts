// Promise 化确认框：const ok = await ask({ title, danger, confirmText })
// 强确认（danger 级联删除）：传 requireText 后需输入匹配文本才能提交。

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  /** 强确认：要求输入该文本（如系统 code）才可提交 */
  requireText?: string
}

interface ConfirmItem extends ConfirmOptions {
  id: number
  resolve: (ok: boolean) => void
}

const queue = reactive<ConfirmItem[]>([])
let seq = 0

function settle(id: number, ok: boolean) {
  const i = queue.findIndex(item => item.id === id)
  const item = i >= 0 ? queue[i] : undefined
  if (!item) return
  item.resolve(ok)
  queue.splice(i, 1)
}

export function useConfirm() {
  async function ask(options: ConfirmOptions): Promise<boolean> {
    if (!import.meta.client) return false
    return new Promise((resolve) => {
      seq += 1
      queue.push({ ...options, id: seq, resolve })
    })
  }
  return { ask }
}

// UiConfirmHost 通过这两个入口结算队列中的弹窗
export function _resolveConfirm(id: number, ok: boolean) {
  settle(id, ok)
}

export function useConfirmQueue(): ConfirmItem[] {
  return queue
}
