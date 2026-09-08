'use client'

import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

import { useSpeechStore } from '@/lib/lab/app/stores/speechStore'
import type { Speaker } from '@/lib/lab/domain/corridor/speech'
import { LAB_FONT_LATIN_REGULAR, fontForText } from '@/lib/lab/domain/labFonts'
import { useLabLabels } from '@/hooks/useLabLabels'

/**
 * 活物头顶那一行字（架构文档 §7）。
 *
 * 从 `ResidentCat` 抽出来的：第二个发言者（狗）一来，"同时只一个气泡 / 每人一个
 * 冷却 / 谁优先"这些规则就需要一处统一——规则在 `domain/corridor/speech.ts`，
 * 持有在 `speechStore`，这里只画。
 *
 * 字号 0.2：0.06 试过，6 单位外只有约 8 像素高，读不出来。字后面垫一块纸片：
 * 白色线稿的活物头顶飘一行灰字，在白墙前是看不见的——先有气泡再有字。
 */
const FONT_SIZE = 0.2
/** 按最长的那句（"...meow" / "Welcome back!"）留边距 */
const WIDTH = 1.4
const HEIGHT = 0.45
const RADIUS = 0.16
/** 指向说话者头顶的小三角 */
const TAIL = 0.14

/** 圆角矩形 + 底部小三角，一笔画成一个 Shape */
function makeBubbleShape(w: number, h: number, r: number, tail: number): THREE.Shape {
  const shape = new THREE.Shape()
  const hw = w / 2
  const hh = h / 2
  shape.moveTo(-hw + r, -hh)
  shape.lineTo(-tail * 0.6, -hh)
  shape.lineTo(0, -hh - tail)
  shape.lineTo(tail * 0.6, -hh)
  shape.lineTo(hw - r, -hh)
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r)
  shape.lineTo(hw, hh - r)
  shape.quadraticCurveTo(hw, hh, hw - r, hh)
  shape.lineTo(-hw + r, hh)
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r)
  shape.lineTo(-hw, -hh + r)
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
  return shape
}

interface SpeechBubbleProps {
  speaker: Speaker
  /** 尾巴尖所在的高度（相对父组原点）：说话者的头顶 */
  anchorY: number
}

export function SpeechBubble({ speaker, anchorY }: SpeechBubbleProps) {
  const labels = useLabLabels()
  const current = useSpeechStore(s => s.speech.current)
  const shape = useMemo(() => makeBubbleShape(WIDTH, HEIGHT, RADIUS, TAIL), [])

  if (!current || current.speaker !== speaker) return null

  /*
    键 → 文案。键不在表里（文案表落后于 reducer）就不画，而不是画出键名：
    `labI18n` 门禁会抓漏译，运行时不该替它兜底。
  */
  const text = (labels.companions as Record<string, string | undefined>)[current.key]
  if (!text) return null

  return (
    <group position={[0, anchorY + TAIL + HEIGHT / 2, 0.02]}>
      {/* 墨线描边：同一形状放大一点垫在底下 */}
      <mesh position={[0, 0, -0.002]} scale={[1.03, 1.05, 1]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color="#3a3a3a" depthWrite={false} />
      </mesh>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color="#fffdf7" depthWrite={false} />
      </mesh>
      <Text
        position={[0, 0, 0.004]}
        fontSize={FONT_SIZE}
        color="#3a3a3a"
        anchorX="center"
        anchorY="middle"
        font={fontForText(text, LAB_FONT_LATIN_REGULAR)}
      >
        {text}
      </Text>
    </group>
  )
}
