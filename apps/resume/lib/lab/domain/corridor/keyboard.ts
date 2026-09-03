/**
 * 走廊的键盘前进 —— 「这次按键归走廊还是归聚焦的控件」这一条判断。
 *
 * ## 为什么值得单独一个文件
 *
 * 空格既是走廊的"前进"，也是**按钮的激活键**（原生 `<button>` 对
 * Space / Enter 都响应）。走廊无条件 `preventDefault()` 之后，Lab 里所有
 * 按钮都没法用空格激活（审计 E4）——键盘用户 Tab 到"打开地图"，按空格，
 * 走廊往前走了一步，地图没开。
 *
 * 原实现只排除了 `INPUT` / `TEXTAREA`。那张名单永远补不完：button、
 * a[href]、select、summary、`[role=button]`、`contenteditable`、以及任何
 * `tabindex >= 0` 的自定义控件都该让路。**规则应该是"焦点在可交互元素上就
 * 让给它"，而不是列出所有例外。**
 *
 * 做成纯函数是为了能直接测这条规则——原来的形态要起一整个 R3F 场景才能验。
 */

/** 走廊响应的按键 → 前进量（负数是往回） */
export const CORRIDOR_KEY_DELTAS: Readonly<Record<string, number>> = {
  ArrowDown: 80,
  ArrowUp: -80,
  PageDown: 300,
  PageUp: -300,
  ' ': 150,
}

/** 焦点在这些标签上时，按键归控件 */
const INTERACTIVE_TAGS = new Set([
  'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY', 'OPTION', 'LABEL',
])

/** 这些 role 表示"这是个控件"，即使标签是 div */
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem',
  'option', 'slider', 'spinbutton', 'textbox', 'combobox',
])

/**
 * 判断这次按键该不该被走廊消费。
 *
 * @param key `KeyboardEvent.key`
 * @param target 事件目标的**最小必要形状**——刻意不要求真的 DOM 元素，
 *   这样测试不必构造 DOM，也不必 mock。`null` 表示无焦点（body）。
 */
export function corridorKeyDelta(
  key: string,
  target: {
    tagName?: string
    getAttribute?: (name: string) => string | null
    isContentEditable?: boolean
  } | null,
): number | null {
  const delta = CORRIDOR_KEY_DELTAS[key]
  if (delta === undefined) return null
  if (target && isInteractive(target)) return null
  return delta
}

function isInteractive(target: {
  tagName?: string
  getAttribute?: (name: string) => string | null
  isContentEditable?: boolean
}): boolean {
  if (target.isContentEditable) return true

  const tag = (target.tagName ?? '').toUpperCase()
  if (INTERACTIVE_TAGS.has(tag)) return true

  const attr = target.getAttribute?.bind(target)
  if (!attr) return false

  const role = attr('role')
  if (role && INTERACTIVE_ROLES.has(role)) return true

  /*
    可聚焦的自定义控件。

    `tabindex="-1"` 只是"可编程聚焦"，不代表用户能 Tab 到它，也不代表它
    会响应空格——那种元素（比如为了 scrollIntoView 而加 tabindex 的容器）
    不该抢走廊的按键。所以只认 >= 0。
  */
  const tabIndex = attr('tabindex')
  if (tabIndex !== null && Number(tabIndex) >= 0) return true

  return false
}
