/**
 * ESC 的消费栈——栈顶（最内层打开的东西）先认领这个键，栈空时才轮到
 * 「退出房间」。与浏览器里嵌套弹窗的行为一致。
 *
 * 模块级而不是 Context：`handleDoorEscape` 是纯函数（在 `DoorSection` 之外被
 * 单测），不该为了问一句「有人认领了吗」变成 hook。
 */

type EscapeConsumer = () => void

const stack: EscapeConsumer[] = []

/** 认领 ESC，返回取消认领的函数。重复 push 会入栈两次——在 effect 清理里取消 */
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

/** 让栈顶消费这次 ESC。`false` = 没人认领，调用侧按自己的语义处理 */
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
