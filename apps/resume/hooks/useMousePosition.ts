import { useState, useEffect } from 'react'

export function useMousePosition() {
  const [pos, setPos] = useState({ nx: 0, ny: 0 })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPos({
        nx: (e.clientX / window.innerWidth) * 2 - 1,
        ny: -((e.clientY / window.innerHeight) * 2 - 1),
      })
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  return pos
}
