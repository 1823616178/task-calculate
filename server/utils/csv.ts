// 公式注入防护：以 = + - @ 或 Tab 开头且不是普通数字的文本，在 Excel/WPS/Numbers
// 中会被当作公式执行，前置单引号强制按文本处理（负数如 -12.5 属于普通数字，不做处理）
const FORMULA_PREFIX = /^[=+\-@\t\r]/

// CSV 字段转义：包含 引号/逗号/换行 时包裹双引号并转义内部引号
export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  let out = text
  if (FORMULA_PREFIX.test(text) && !Number.isFinite(Number(text))) {
    out = `'${text}`
  }
  if (/[",\r\n]/.test(out)) {
    return `"${out.replaceAll('"', '""')}"`
  }
  return out
}

export function csvLine(fields: unknown[]): string {
  return `${fields.map(csvEscape).join(',')}\n`
}
