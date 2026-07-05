'use client'

import { useEffect, useRef } from 'react'
import { ThreeScene } from '../../lib/scene/ThreeScene'

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<ThreeScene | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new ThreeScene(canvas)
    sceneRef.current = scene

    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = -((e.clientY / window.innerHeight) * 2 - 1)
      scene.setMouse(nx, ny)
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
