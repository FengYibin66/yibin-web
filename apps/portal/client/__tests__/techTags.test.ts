import { describe, expect, it } from 'vitest'

import { parseTechTags } from '../src/lib/techTags'

/**
 * 这是 portal client 的第一个测试。
 *
 * 起因是一个真实缺陷：`Projects.tsx` 直接 `JSON.parse(project.techTags ?? '[]')`，
 * 而 `tech_tags` 在库里是自由文本列（CHECK 约束只覆盖 status 与 visible）。
 * 一条非法 JSON 就会让首页整个项目区白屏——渲染路径不该因单条脏数据整体崩掉。
 */
describe('parseTechTags', () => {
  describe('正常输入', () => {
    it('解析字符串数组', () => {
      expect(parseTechTags('["ts","go"]')).toEqual(['ts', 'go'])
    })

    it('空数组', () => {
      expect(parseTechTags('[]')).toEqual([])
    })

    it('单元素', () => {
      expect(parseTechTags('["react"]')).toEqual(['react'])
    })

    it('保留中文与特殊字符', () => {
      expect(parseTechTags('["前端","C++","Node.js"]')).toEqual(['前端', 'C++', 'Node.js'])
    })
  })

  describe('空值', () => {
    it.each([
      [null, 'null'],
      [undefined, 'undefined'],
      ['', '空字符串'],
    ])('%s（%s）→ 空数组', (input) => {
      expect(parseTechTags(input as string | null | undefined)).toEqual([])
    })
  })

  describe('脏数据不崩溃（核心用途）', () => {
    it.each([
      ['not json at all', '纯文本'],
      ['[unclosed', '截断的数组'],
      ['{broken', '截断的对象'],
      ['["a",]', '尾随逗号'],
      ["['single']", '单引号'],
      ['undefined', '字面 undefined'],
      ['NaN', '字面 NaN'],
    ])('%s（%s）→ 空数组而非抛异常', (input) => {
      expect(() => parseTechTags(input)).not.toThrow()
      expect(parseTechTags(input)).toEqual([])
    })
  })

  describe('parse 成功但形状不对（内联 try/catch 挡不住的那一类）', () => {
    it('对象 → 空数组', () => {
      // 若不校验形状，调用方的 .join() 会得到意外结果
      expect(parseTechTags('{"a":1}')).toEqual([])
    })

    it('数字 → 空数组', () => {
      expect(parseTechTags('42')).toEqual([])
    })

    it('字符串字面量 → 空数组', () => {
      expect(parseTechTags('"just a string"')).toEqual([])
    })

    it('null 字面量 → 空数组', () => {
      expect(parseTechTags('null')).toEqual([])
    })

    it('布尔 → 空数组', () => {
      expect(parseTechTags('true')).toEqual([])
    })

    it('数组里混入非字符串 → 只保留字符串项', () => {
      expect(parseTechTags('["ts",1,null,{"a":1},"go",true]')).toEqual(['ts', 'go'])
    })

    it('全是非字符串的数组 → 空数组', () => {
      expect(parseTechTags('[1,2,3]')).toEqual([])
    })

    it('嵌套数组项被剔除（不会渲染成 [object Object]）', () => {
      expect(parseTechTags('[["nested"],"ok"]')).toEqual(['ok'])
    })
  })

  describe('返回值可安全用于渲染路径', () => {
    it('结果总是数组，可直接 .map / .join', () => {
      for (const input of ['bad', '{"x":1}', '["a"]', null, '']) {
        const out = parseTechTags(input as string | null)
        expect(Array.isArray(out)).toBe(true)
        expect(() => out.join(', ')).not.toThrow()
        expect(out.every((t) => typeof t === 'string')).toBe(true)
      }
    })
  })
})
