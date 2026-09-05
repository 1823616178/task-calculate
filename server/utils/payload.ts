// 入库 payload 序列化：原始报文截断到 maxLen，防止超大/恶意消息撑爆 TEXT 列或拖慢写入
const TRUNCATED_SUFFIX = '…(truncated)'

export const DEFAULT_PAYLOAD_MAX_LENGTH = 2048

export function stringifyPayload(raw: unknown, maxLen: number = DEFAULT_PAYLOAD_MAX_LENGTH): string | null {
  let text: string
  try {
    text = JSON.stringify(raw ?? null)
  }
  catch {
    return null
  }
  if (text.length <= maxLen) return text
  return `${text.slice(0, Math.max(0, maxLen - TRUNCATED_SUFFIX.length))}${TRUNCATED_SUFFIX}`
}
