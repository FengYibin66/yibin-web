/**
 * 「Lab 资源加载完成」的信号（ADR 20260908204302）。
 *
 * 发送方是 `LabLoader`（`useStableProgress` 的稳定完成），接收方是 `SceneProvider`
 * （把走廊状态机从 `loading` 推到 `corridor`）。两者在 `LabClient` 里是**兄弟**，
 * LabLoader 不在 SceneProvider 之下，不能用 context——第一版就是这么把整个 Lab
 * 弄崩的（`useScene must be used within a SceneProvider`）。
 *
 * 模块级、可迟到订阅：订阅时已经加载完就立刻回调，不会因为顺序问题漏掉。
 */

let loaded = false
const listeners = new Set<() => void>()

export function markLabLoaded(): void {
  if (loaded) return
  loaded = true
  for (const cb of listeners) cb()
}

export function isLabLoaded(): boolean {
  return loaded
}

/** 订阅；已加载则同步回调一次。返回退订函数 */
export function onLabLoaded(cb: () => void): () => void {
  if (loaded) {
    cb()
    return () => {}
  }
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** 测试用 */
export function resetLabLoaded(): void {
  loaded = false
  listeners.clear()
}
