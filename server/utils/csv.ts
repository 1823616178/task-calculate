// CSV 字段转义：包含 引号/逗号/换行 时包裹双引号并转义内部引号
export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function csvLine(fields: unknown[]): string {
  return `${fields.map(csvEscape).join(',')}\n`
}
