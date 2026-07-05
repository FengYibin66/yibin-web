export interface SceneConfig {
  nodeCount: number
  nodeRadius: number
  edgeDistanceThreshold: number
  colors: readonly [string, string, string]
  nodeOpacity: number         // instance material opacity (1 = opaque)
  edgeOpacity: number         // edge line opacity
  cameraZ: number
  cameraFov: number
  ambientIntensity: number
  pointLightIntensity: number
  pointLightDistance: number
  driftSpeed: number
  driftAmplitude: number
  lerpFactor: number
  maxParallaxX: number
  maxParallaxY: number
}

export const DESKTOP_CONFIG: SceneConfig = {
  nodeCount: 90,
  nodeRadius: 0.08,
  edgeDistanceThreshold: 2.5,
  colors: ['#00d4ff', '#6366f1', '#8b5cf6'],
  nodeOpacity: 1,
  edgeOpacity: 0.12,
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

// Light theme: fewer nodes, lower opacity to avoid clashing with light background
export const DESKTOP_CONFIG_LIGHT: SceneConfig = {
  ...DESKTOP_CONFIG,
  nodeCount: 60,
  nodeOpacity: 0.45,
  edgeOpacity: 0.08,
  ambientIntensity: 0.6,
  pointLightIntensity: 1.5,
}

export const MOBILE_CONFIG: SceneConfig = {
  ...DESKTOP_CONFIG,
  nodeCount: 35,
  edgeDistanceThreshold: 0,
}

export const MOBILE_CONFIG_LIGHT: SceneConfig = {
  ...DESKTOP_CONFIG_LIGHT,
  nodeCount: 20,
  edgeDistanceThreshold: 0,
}
