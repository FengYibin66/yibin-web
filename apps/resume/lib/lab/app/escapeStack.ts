/**
 * ESC 的消费栈 —— 最内层打开的东西先认领这个键。
 *
 * ## 为什么需要
 *
 * ESC 在 Lab 里已经绑定了「退出房间」（`handleDoorEscape`）。Projects 房间
 * 的「收回停靠」也想用 ESC，于是两个 window 监听同时触发：房间开始退场，
 * 而收回那条路径被 `isExiting` 挡掉。实机相位序列长这样：
 *
 *   docked → undocking → undocking(exiting) → browsing(exiting)
 *
 * 表现是「按 ESC 直接退出了房间，停靠白点」。这不是哪一方写错了，是**没人
 * 定义谁优先**——ESC 的语义天然是「关掉最内层的那个东西」。
 *
 * ## 语义
 *
 * 栈顶优先。房间里打开了细节视图时它在栈顶，ESC 关它；关掉之后栈空，
 * ESC 才回到「退出房间」。这与浏览器里嵌套弹窗的行为一致。
 *
 * 做成模块级而不是 Context：`handleDoorEscape` 是个纯函数（在
 * `DoorSection` 之外被单测），它不该为了问一句"有人认领了吗"而变成 hook。
 *
 * Publications 房间的「打开单篇」是同一类冲突，可以直接复用。
 */

type EscapeConsumer = () => void

const stack: EscapeConsumer[] = []

/**
 * 认领 ESC。返回取消认领的函数。
 *
 * 同一个消费者重复 push 会入栈两次——调用侧应当在 effect 的清理里取消，
 * 而不是依赖去重。
 */
export function pushEscapeConsumer(consumer: EscapeConsumer): () => void {
  stack.push(consumer)
  let released = false
  return () => {
    if (released) return
    released = true
    const index = stack.lastIndexOf(consumer)
    if (index !== -1) stack.splice(index, 1)
  }
}

/**
 * 让栈顶消费掉这次 ESC。
 *
 * @returns 是否被消费。`false` 表示没人认领，调用侧可以按自己的语义处理。
 */
export function consumeEscape(): boolean {
  const consumer = stack.at(-1)
  if (!consumer) return false
  consumer()
  return true
}

/** 当前有几个消费者（测试与调试用） */
export function escapeConsumerCount(): number {
  return stack.length
}

/** 清空。**只给测试用**——生产里每个消费者都该自己取消认领 */
export function resetEscapeStack(): void {
  stack.length = 0
}
