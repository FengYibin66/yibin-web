'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function BackButton() {
  const params = useSearchParams()
  const router = useRouter()

  // 无 `?from=` 时**仍然渲染**，默认回 `/classic`。
  //
  // 原先是 `if (!from || ...) return null`——而 Navbar 里的 `/gallery` 链接不带 query，
  // 于是从 Classic 顶栏进相册的人一个返回入口都没有，只能按系统返回键或关标签。
  // 这不是布局问题（按钮 z=9999 不会被挡），是逻辑上就没渲染。
  // 默认回 `/classic` 而不是 `/lab`：直接打开相册链接的人没进过 3D 走廊，
  // 把他扔进走廊是意外跳转。
  const from = params.get('from')
  const isFromLab = from === 'lab'
  const label = isFromLab ? 'Back to Corridor' : 'Back to Portfolio'
  const href = isFromLab ? '/lab' : '/classic'

  return (
    <button
      onClick={() => router.push(href)}
      style={{
        position: 'fixed',
        top: 20,
        left: 20,
        zIndex: 9999,
        background: 'rgba(255,255,255,0.9)',
        border: '1.5px solid rgba(42,31,14,0.15)',
        borderRadius: 6,
        padding: '8px 14px',
        fontFamily: 'var(--font-sketch-bold)',
        fontSize: 13,
        color: '#2a1f0e',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      aria-label={label}
    >
      ← {label}
    </button>
  )
}

export function GalleryBackButton() {
  return (
    <Suspense fallback={null}>
      <BackButton />
    </Suspense>
  )
}
