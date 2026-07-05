import {
  Scene, IcosahedronGeometry, MeshStandardMaterial, InstancedMesh,
  Object3D, Color, BufferGeometry, BufferAttribute,
  LineSegments, LineBasicMaterial, AmbientLight, PointLight,
} from 'three'
import type { SceneConfig } from './types'

interface NodeData {
  baseX: number; baseY: number; baseZ: number
  driftSeedX: number; driftSeedY: number; driftSeedZ: number
  colorIndex: number
}

export class NodeGraph {
  private mesh: InstancedMesh
  private lines: LineSegments
  private nodes: NodeData[]
  private config: SceneConfig
  private dummy = new Object3D()
  private edgePositions: Float32Array
  private currentPositions: Float32Array
  private ambient: AmbientLight
  private point: PointLight

  constructor(scene: Scene, config: SceneConfig) {
    this.config = config
    const colors = config.colors.map((hex) => new Color(hex))

    const geo = new IcosahedronGeometry(config.nodeRadius, 0)
    const mat = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x000000,
      transparent: config.nodeOpacity < 1,
      opacity: config.nodeOpacity,
    })
    this.mesh = new InstancedMesh(geo, mat, config.nodeCount)

    this.nodes = Array.from({ length: config.nodeCount }, (_, i) => ({
      baseX: (Math.random() - 0.5) * 10,
      baseY: (Math.random() - 0.5) * 10,
      baseZ: (Math.random() - 0.5) * 6,
      driftSeedX: Math.random() * Math.PI * 2,
      driftSeedY: Math.random() * Math.PI * 2,
      driftSeedZ: Math.random() * Math.PI * 2,
      colorIndex: i % 3,
    }))

    for (let i = 0; i < config.nodeCount; i++) {
      const node = this.nodes[i]
      this.dummy.position.set(node.baseX, node.baseY, node.baseZ)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.mesh.setColorAt(i, colors[node.colorIndex])
    }
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true

    // Pre-allocate edge buffer (worst case: all node pairs)
    this.edgePositions = new Float32Array(config.nodeCount * config.nodeCount * 6)
    this.currentPositions = new Float32Array(config.nodeCount * 3)

    const edgeGeo = new BufferGeometry()
    edgeGeo.setAttribute('position', new BufferAttribute(this.edgePositions, 3))
    edgeGeo.setDrawRange(0, 0)
    this.lines = new LineSegments(
      edgeGeo,
      new LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: config.edgeOpacity }),
    )

    this.ambient = new AmbientLight(0xffffff, config.ambientIntensity)
    this.point = new PointLight(0xffffff, config.pointLightIntensity, config.pointLightDistance)
    this.point.position.set(0, 5, 5)
    scene.add(this.mesh, this.lines, this.ambient, this.point)
  }

  update(elapsed: number): void {
    const { driftSpeed, driftAmplitude } = this.config

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i]
      const x = n.baseX + Math.sin(elapsed * driftSpeed + n.driftSeedX) * driftAmplitude
      const y = n.baseY + Math.cos(elapsed * driftSpeed * 0.7 + n.driftSeedY) * driftAmplitude
      const z = n.baseZ + Math.sin(elapsed * driftSpeed * 0.5 + n.driftSeedZ) * driftAmplitude * 0.5
      this.dummy.position.set(x, y, z)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.currentPositions[i * 3] = x
      this.currentPositions[i * 3 + 1] = y
      this.currentPositions[i * 3 + 2] = z
    }
    this.mesh.instanceMatrix.needsUpdate = true

    const threshold = this.config.edgeDistanceThreshold
    let vertexCount = 0
    if (threshold > 0) {
      const count = this.nodes.length
      const threshSq = threshold * threshold
      for (let i = 0; i < count; i++) {
        const ax = this.currentPositions[i * 3]
        const ay = this.currentPositions[i * 3 + 1]
        const az = this.currentPositions[i * 3 + 2]
        for (let j = i + 1; j < count; j++) {
          const dx = ax - this.currentPositions[j * 3]
          const dy = ay - this.currentPositions[j * 3 + 1]
          const dz = az - this.currentPositions[j * 3 + 2]
          if (dx * dx + dy * dy + dz * dz < threshSq) {
            const o = vertexCount * 3
            this.edgePositions[o] = ax; this.edgePositions[o + 1] = ay; this.edgePositions[o + 2] = az
            this.edgePositions[o + 3] = this.currentPositions[j * 3]
            this.edgePositions[o + 4] = this.currentPositions[j * 3 + 1]
            this.edgePositions[o + 5] = this.currentPositions[j * 3 + 2]
            vertexCount += 2
          }
        }
      }
    }
    const geo = this.lines.geometry
    geo.setDrawRange(0, vertexCount)
    if (vertexCount > 0) {
      geo.attributes['position'].needsUpdate = true
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as MeshStandardMaterial).dispose()
    this.mesh.removeFromParent()
    this.lines.geometry.dispose()
    ;(this.lines.material as LineBasicMaterial).dispose()
    this.lines.removeFromParent()
    this.ambient.removeFromParent()
    this.point.removeFromParent()
  }
}
