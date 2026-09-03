/**
 * Gallery 的加载态。
 *
 * 存在的理由（验收报告 P1-3）：`GalleryTrack` 以 `dynamic(..., { ssr: false })`
 * 加载且**没有 loading fallback**，导出的 `/gallery/index.html` 里可见文本
 * 只有 `<title>`——首次进入时 chunk 与图片就位之前，整页只有一片背景色。
 * Lab 的 Gallery 门还会在相机对齐后直接 `router.push('/gallery')`，
 * 那条路径绕过了普通房间的 RoomReadyBoundary，连统一的 loading 都没有。
 *
 * 配色与 Gallery 页面自身一致（#f0ece4），避免加载态自己造成一次闪色。
 */
export function GalleryLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading gallery"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        background: '#f0ece4',
        color: '#3b3630',
        fontFamily: 'var(--font-cormorant-garamond), Georgia, serif',
      }}
    >
      {/* 纯 CSS 动画：加载态本身不能再依赖另一个 JS chunk */}
      <div
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          border: '2px solid rgba(59, 54, 48, 0.18)',
          borderTopColor: '#3b3630',
          borderRadius: '50%',
          animation: 'gallery-spin 900ms linear infinite',
        }}
      />
      <p style={{ margin: 0, fontSize: '1.05rem', letterSpacing: '0.04em' }}>
        Loading gallery…
      </p>
      <style>{`
        @keyframes gallery-spin { to { transform: rotate(360deg) } }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] > div { animation: none }
        }
      `}</style>
    </div>
  )
}
