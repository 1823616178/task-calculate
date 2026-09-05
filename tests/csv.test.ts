import { describe, expect, it } from 'vitest'
import { csvEscape, csvLine } from '../server/utils/csv'

describe('csvEscape 公式注入防护', () => {
  it('以 = + @ 开头的文本前置单引号', () => {
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvEscape('+cmd')).toBe("'+cmd")
    expect(csvEscape('@import')).toBe("'@import")
  })

  it('普通负数不处理（保持数值语义）', () => {
    expect(csvEscape(-12.5)).toBe('-12.5')
    expect(csvEscape('-12.5')).toBe('-12.5')
  })

  it('以 - 开头但非数字的文本前置单引号', () => {
    expect(csvEscape('-cmd')).toBe("'-cmd")
  })

  it('语法转义仍然生效（引号/逗号/换行）', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })

  it('危险前缀 + 语法字符同时生效', () => {
    expect(csvEscape('=1,2')).toBe('"\'=1,2"')
  })

  it('null/undefined 输出空串', () => {
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })

  it('csvLine 拼接整行', () => {
    expect(csvLine(['a', 1, '=x'])).toBe("a,1,'=x\n")
  })
})
