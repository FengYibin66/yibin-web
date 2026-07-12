'use client'

import { forwardRef, useMemo, useRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export interface PaperMaterialHandle {
  bend: number
  windStrength: number
  uProgress: number
  material: THREE.MeshBasicMaterial | null
}

interface PaperMaterialProps {
  color?: string
  map?: THREE.Texture | null
  mapBack?: THREE.Texture | null
  mapPainted?: THREE.Texture | null
  side?: THREE.Side
  paintProgress?: { value: number }
  roomOrigin?: { value: THREE.Vector3 }
}

const PaperMaterial = forwardRef<PaperMaterialHandle, PaperMaterialProps>(function PaperMaterial(
  { color = '#e0e0e0', map, mapBack, mapPainted, side = THREE.DoubleSide, paintProgress, roomOrigin },
  ref
) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)

  const onBeforeCompile = useMemo(() => (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uBend         = { value: 0 }
    shader.uniforms.uTime         = { value: 0 }
    shader.uniforms.uWindStrength = { value: 0 }
    shader.uniforms.mapBack       = { value: null }
    shader.uniforms.mapPainted    = { value: null }
    shader.uniforms.uProgress     = { value: 0.0 }
    shader.uniforms.uPaintProgress = (paintProgress ?? { value: 1.0 }) as THREE.IUniform
    shader.uniforms.uRoomOrigin   = (roomOrigin    ?? { value: new THREE.Vector3(0, 0, 0) }) as THREE.IUniform

    shader.vertexShader = `
      uniform float uBend;
      uniform float uTime;
      uniform float uWindStrength;
      varying vec3 vWorldPositionColor;
    ` + shader.vertexShader

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vWorldPositionColor = (modelMatrix * vec4(position, 1.0)).xyz;
      float bendAmount = pow(transformed.y, 2.0) * uBend;
      transformed.z += bendAmount;
      float totalWind = 0.02 + uWindStrength;
      float flutter = sin(uTime * 2.0 + transformed.y * 2.0) * totalWind * (1.0 + abs(uBend * 3.0));
      transformed.z += flutter;
      `
    )

    shader.fragmentShader = `
      uniform sampler2D mapBack;
      uniform sampler2D mapPainted;
      uniform float uProgress;
      uniform float uPaintProgress;
      uniform vec3 uRoomOrigin;
      varying vec3 vWorldPositionColor;

      float revealRand(vec2 n) {
        return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
      }
      float revealNoise(vec2 p) {
        vec2 ip = floor(p);
        vec2 u  = fract(p);
        u = u * u * (3.0 - 2.0 * u);
        float res = mix(
          mix(revealRand(ip), revealRand(ip + vec2(1.0,0.0)), u.x),
          mix(revealRand(ip + vec2(0.0,1.0)), revealRand(ip + vec2(1.0,1.0)), u.x),
          u.y);
        return res * res;
      }
    ` + shader.fragmentShader

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #ifdef USE_MAP
        vec4 texColor = texture2D(map, vMapUv);
        if (gl_FrontFacing && uProgress > 0.001) {
          vec4 paintedColor = texture2D(mapPainted, vMapUv);
          float rn = revealNoise(vMapUv * 15.0) * 0.15;
          float maskValue = (1.0 - vMapUv.y) + rn;
          if (maskValue < uProgress * 1.5) { texColor = paintedColor; }
        }
        vec2 backUv = vec2(vMapUv.x, 1.0 - vMapUv.y);
        vec4 backColor = texture2D(mapBack, backUv);
        vec4 sampledDiffuseColor = gl_FrontFacing ? texColor : backColor;
        diffuseColor *= sampledDiffuseColor;
        diffuseColor.rgb *= 1.4;
      #endif
      `
    )

    if (materialRef.current) materialRef.current.userData.shader = shader
    if (mapBack   && shader.uniforms.mapBack)    shader.uniforms.mapBack.value    = mapBack
    if (mapPainted && shader.uniforms.mapPainted) shader.uniforms.mapPainted.value = mapPainted
  }, [mapBack, mapPainted, paintProgress, roomOrigin])

  useImperativeHandle(ref, () => ({
    get bend()        { return materialRef.current?.userData?.shader?.uniforms.uBend?.value ?? 0 },
    set bend(v: number) { if (materialRef.current?.userData?.shader) materialRef.current.userData.shader.uniforms.uBend.value = v },
    get windStrength()  { return materialRef.current?.userData?.shader?.uniforms.uWindStrength?.value ?? 0 },
    set windStrength(v: number) { if (materialRef.current?.userData?.shader) materialRef.current.userData.shader.uniforms.uWindStrength.value = v },
    get uProgress()   { return materialRef.current?.userData?.shader?.uniforms.uProgress?.value ?? 0 },
    set uProgress(v: number) { if (materialRef.current?.userData?.shader) materialRef.current.userData.shader.uniforms.uProgress.value = v },
    get material()    { return materialRef.current },
  }))

  useFrame((state) => {
    const s = materialRef.current?.userData?.shader
    if (!s) return
    s.uniforms.uTime.value = state.clock.getElapsedTime()
    if (s.uniforms.mapBack)    s.uniforms.mapBack.value    = mapBack    ?? null
    if (s.uniforms.mapPainted) s.uniforms.mapPainted.value = mapPainted ?? null
  })

  return (
    <meshBasicMaterial
      ref={materialRef}
      map={map === null ? undefined : map}
      color={color as string}
      side={side as THREE.Side}
      onBeforeCompile={onBeforeCompile}
      needsUpdate
    />
  )
})

export default PaperMaterial
