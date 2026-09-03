import { describe, expect, it } from 'vitest'

import {
  CORRIDOR_KEY_DELTAS,
  corridorKeyDelta,
} from '@/lib/lab/domain/corridor/keyboard'

/**
 * 走廊键盘前进与控件的按键归属（审计 E4）。
 *
 * 空格既是走廊的"前进"，也是原生 `<button>` 的激活键。走廊无条件
 * `preventDefault()` 之后，Lab 里所有按钮都没法用空格激活——键盘用户
 * Tab 到"打开地图"，按空格，走廊往前走一步，地图没开。
 *
 * 原实现只排除 `INPUT` / `TEXTAREA`。这一组测试钉住的是**规则的形态**：
 * 「焦点在可交互元素上就让给它」，而不是"列出所有例外"（那张名单永远补不完）。
 */

const el = (tagName: string, attrs: Record<string, string> = {}) => ({
  tagName,
  getAttribute: (name: string) => attrs[name] ?? null,
})

describe('无焦点（body）时走廊消费按键', () => {
  it('响应声明的每个键', () => {
    for (const [key, delta] of Object.entries(CORRIDOR_KEY_DELTAS)) {
      expect(corridorKeyDelta(key, null), `${key} 没被消费`).toBe(delta)
    }
  })

  it('不响应别的键 —— 否则会吞掉 Tab、Esc 之类', () => {
    for (const key of ['Tab', 'Escape', 'Enter', 'a', 'F5', 'ArrowLeft', 'ArrowRight']) {
      expect(corridorKeyDelta(key, null), `${key} 被走廊吞了`).toBeNull()
    }
  })

  it('空格是往前，PageUp 是往回', () => {
    expect(corridorKeyDelta(' ', null)!).toBeGreaterThan(0)
    expect(corridorKeyDelta('PageUp', null)!).toBeLessThan(0)
  })
})

describe('焦点在控件上时让给控件', () => {
  it('原生可交互标签一律让路', () => {
    for (const tag of ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY', 'LABEL']) {
      expect(
        corridorKeyDelta(' ', el(tag)),
        `焦点在 <${tag.toLowerCase()}> 上时空格被走廊吞了`,
      ).toBeNull()
    }
  })

  it('小写标签名也认（不同来源的 tagName 大小写不一）', () => {
    expect(corridorKeyDelta(' ', el('button'))).toBeNull()
  })

  it('role 表明是控件时让路 —— 即使标签是 div', () => {
    for (const role of ['button', 'link', 'checkbox', 'switch', 'slider', 'tab']) {
      expect(
        corridorKeyDelta(' ', el('DIV', { role })),
        `role=${role} 的元素被走廊抢了按键`,
      ).toBeNull()
    }
  })

  it('contenteditable 让路', () => {
    expect(corridorKeyDelta(' ', { tagName: 'DIV', isContentEditable: true })).toBeNull()
  })

  it('tabindex >= 0 的自定义控件让路', () => {
    expect(corridorKeyDelta(' ', el('DIV', { tabindex: '0' }))).toBeNull()
    expect(corridorKeyDelta(' ', el('DIV', { tabindex: '3' }))).toBeNull()
  })

  it('tabindex="-1" 不让路 —— 那只是"可编程聚焦"，不响应空格', () => {
    // 比如为了 scrollIntoView 而加 tabindex 的容器，不该抢走廊的按键
    expect(corridorKeyDelta(' ', el('DIV', { tabindex: '-1' }))).toBe(CORRIDOR_KEY_DELTAS[' '])
  })

  it('普通的非交互元素不让路 —— 走廊仍能前进', () => {
    for (const tag of ['DIV', 'SPAN', 'P', 'CANVAS', 'SECTION', 'BODY']) {
      expect(
        corridorKeyDelta(' ', el(tag)),
        `焦点在 <${tag.toLowerCase()}> 上时走廊不该停`,
      ).toBe(CORRIDOR_KEY_DELTAS[' '])
    }
  })

  it('role 是非交互值时不让路', () => {
    for (const role of ['presentation', 'none', 'status', 'alert', 'main']) {
      expect(corridorKeyDelta(' ', el('DIV', { role }))).toBe(CORRIDOR_KEY_DELTAS[' '])
    }
  })

  it('方向键也遵守同一条规则 —— 焦点在 select 上时上下键归 select', () => {
    expect(corridorKeyDelta('ArrowDown', el('SELECT'))).toBeNull()
    expect(corridorKeyDelta('ArrowDown', el('DIV'))).toBe(CORRIDOR_KEY_DELTAS.ArrowDown)
  })

  it('缺 getAttribute 的目标不炸（非 DOM 的事件目标）', () => {
    expect(() => corridorKeyDelta(' ', { tagName: 'DIV' })).not.toThrow()
    expect(corridorKeyDelta(' ', {})).toBe(CORRIDOR_KEY_DELTAS[' '])
  })
})
