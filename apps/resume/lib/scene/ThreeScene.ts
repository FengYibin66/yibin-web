import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Clock,
} from 'three'
import { NodeGraph } from './NodeGraph'
import { DESKTOP_CONFIG, MOBILE_CONFIG } from './types'
import type { SceneConfig } from './types'

export class ThreeScene {
  private canvas: HTMLCanvasElement
  private renderer: WebGLRenderer
  private scene: Scene
  private camera: PerspectiveCamera
  private config: SceneConfig
  private nodeGraph: NodeGraph
  private clock: Clock
  private rafId = 0
  private resizeObserver: ResizeObserver
  private mouseTargetX = 0
  private mouseTargetY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    const isMobile = window.innerWidth < 768
    this.config = isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))

    this.scene = new Scene()
    this.scene.background = null

    this.camera = new PerspectiveCamera(this.config.cameraFov, 1, 0.1, 100)
    this.camera.position.set(0, 0, this.config.cameraZ)

    this.clock = new Clock()
    this.nodeGraph = new NodeGraph(this.scene, this.config)

    this.handleResize()

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas)

    this.startLoop()
  }

  private handleResize(): void {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private startLoop(): void {
    const tick = () => {
      this.rafId = requestAnimationFrame(tick)
      const elapsed = this.clock.getElapsedTime()
      this.nodeGraph.update(elapsed)
      this.camera.position.x +=
        (this.mouseTargetX - this.camera.position.x) * this.config.lerpFactor
      this.camera.position.y +=
        (this.mouseTargetY - this.camera.position.y) * this.config.lerpFactor
      this.camera.lookAt(0, 0, 0)
      this.renderer.render(this.scene, this.camera)
    }
    tick()
  }

  setMouse(nx: number, ny: number): void {
    this.mouseTargetX = nx * this.config.maxParallaxX
    this.mouseTargetY = ny * this.config.maxParallaxY
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId)
    this.resizeObserver.disconnect()
    this.nodeGraph.dispose()
    this.renderer.dispose()
  }
}
