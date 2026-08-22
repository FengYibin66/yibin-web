import '@testing-library/jest-dom'

// Node 25 内置了一个实验性的 `localStorage` 全局，未带 `--localstorage-file` 启动时
// 一经访问就抛 SecurityError（"Cannot initialize local storage without a
// `--localstorage-file` path"）。它定义在 globalThis 上，会盖过 vitest jsdom 环境
// 提供的实现，于是任何触碰 localStorage 的组件在测试里直接崩——LocaleProvider 的
// useEffect 读 'resume-locale' 就是一例，曾导致 publicationCard 与 projectsRoomCamera
// 两个文件共 16 个测试全红。
//
// 这里装一个内存实现顶掉它。用 defineProperty 而非赋值：Node 的全局是 getter，
// 直接赋值在 strict mode 下无效。
function createMemoryStorage(): Storage {
  let store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store = new Map()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value))
    },
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  let usable = false
  try {
    // 访问即可能抛（Node 25 的 getter）；能读到 getItem 才算可用
    usable = typeof (globalThis as Record<string, unknown>)[name] === 'object' &&
      typeof (globalThis as unknown as Record<string, Storage>)[name]?.getItem === 'function'
  } catch {
    usable = false
  }

  if (!usable) {
    Object.defineProperty(globalThis, name, {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    })
  }
}
