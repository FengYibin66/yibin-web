export interface SceneConfig {
  nodeCount: number
  nodeRadius: number          // geometry radius
  edgeDistanceThreshold: number
  colors: readonly [string, string, string]  // hex strings
  cameraZ: number
  cameraFov: number
  ambientIntensity: number
  pointLightIntensity: number
  pointLightDistance: number
  driftSpeed: number          // multiplier for drift animation
  driftAmplitude: number      // max drift offset
  lerpFactor: number          // camera parallax lerp factor
  maxParallaxX: number
  maxParallaxY: number
}

export const DESKTOP_CONFIG: SceneConfig = {
  nodeCount: 90,
  nodeRadius: 0.08,
  edgeDistanceThreshold: 2.5,
  colors: ['#00d4ff', '#6366f1', '#8b5cf6'],
  cameraZ: 8,
  cameraFov: 60,
  ambientIntensity: 0.4,
  pointLightIntensity: 3,
  pointLightDistance: 25,
  driftSpeed: 0.3,
  driftAmplitude: 0.4,
  lerpFactor: 0.05,
  maxParallaxX: 0.5,
  maxParallaxY: 0.3,
}

export const MOBILE_CONFIG: SceneConfig = {
  ...DESKTOP_CONFIG,
  nodeCount: 35,
  edgeDistanceThreshold: 0,   // 0 = no edges on mobile
}
