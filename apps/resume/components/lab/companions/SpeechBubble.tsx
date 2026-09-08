'use client'

import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

import { useSpeechStore } from '@/lib/lab/app/stores/speechStore'
import { activeSpeechFor, type Speaker } from '@/lib/lab/domain/corridor/speech'
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
/** 宽随文案：短句不留 40% 空白，长句不画到纸外（UX 评审）。夹在 [0.62, 1.8] */
const MIN_WIDTH = 0.62
const MAX_WIDTH = 1.8
const HEIGHT = 0.45
const RADIUS = 0.16
/** 指向说话者头顶的小三角 */
const TAIL = 0.14

/** 中日韩字比拉丁字宽得多，按字符类型估宽 */
function bubbleWidth(text: string): number {
  let w = 0
  for (const ch of text) w += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? FONT_SIZE * 1.0 : FONT_SIZE * 0.56
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w + 0.3))
}

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
  const speech = useSpeechStore(s => s.speech)
  // 规则层决定"这一刻谁在说"；过期由 store 的定时器清，这里只按发言者取
  const current = activeSpeechFor(speech, speaker, Date.now())

  /*
    键 → 文案。键不在表里（文案表落后于 reducer）就不画，而不是画出键名：
    `labI18n` 门禁会抓漏译，运行时不该替它兜底。
  */
  const text = current ? (labels.companions as Record<string, string | undefined>)[current.key] : undefined
  const width = useMemo(() => bubbleWidth(text ?? ''), [text])
  const shape = useMemo(() => makeBubbleShape(width, HEIGHT, RADIUS, TAIL), [width])
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
        maxWidth={width - 0.16}
      >
        {text}
      </Text>
    </group>
  )
}
