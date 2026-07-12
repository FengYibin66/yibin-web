'use client'

import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, useTexture, Html, useCursor } from '@react-three/drei'
import * as THREE from 'three'

const PAPER_WIDTH  = 1.51
const PAPER_HEIGHT = 1.7
const FONT_PATH    = '/fonts/CabinSketch-Regular.ttf'

interface InteractiveTextFieldProps {
  isActive: boolean
  value: string
  placeholder: string
  cursor: string
  position: [number, number, number]
  baseRotation: [number, number, number]
  hitboxPosition: [number, number, number]
  hitboxSize: [number, number]
  fontSize: number
  maxWidth: number
  anchorX?: 'left' | 'center' | 'right'
  anchorY?: 'top' | 'middle' | 'bottom'
  fontPath: string
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  onClick: () => void
}

const InteractiveTextField = ({
  isActive, value, placeholder, cursor,
  position, baseRotation, hitboxPosition, hitboxSize,
  fontSize, maxWidth, anchorX = 'left', anchorY = 'middle',
  fontPath, textAlign, lineHeight, onClick,
}: InteractiveTextFieldProps) => {
  const textRef = useRef<THREE.Object3D>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const targetY    = hovered ? position[1] + 0.007 : position[1]
  const targetRotZ = hovered ? baseRotation[2] + 0.015 : baseRotation[2]

  useFrame((_, delta) => {
    const t = delta * 12
    if (textRef.current) {
      textRef.current.position.y = THREE.MathUtils.lerp(textRef.current.position.y, targetY, t)
      textRef.current.rotation.z = THREE.MathUtils.lerp(textRef.current.rotation.z, targetRotZ, t)
    }
  })

  return (
    <group
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <mesh position={hitboxPosition} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={hitboxSize} />
        <meshBasicMaterial color="#e0e0e0" colorWrite={false} depthWrite={false} />
      </mesh>
      <Text
        renderOrder={1}
        ref={textRef}
        position={position}
        rotation={baseRotation}
        fontSize={fontSize}
        color={hovered ? '#111111' : '#333333'}
        font={fontPath}
        anchorX={anchorX}
        anchorY={anchorY}
        maxWidth={maxWidth}
        textAlign={textAlign}
        lineHeight={lineHeight}
      >
        {isActive ? (value + cursor) : (value || placeholder)}
      </Text>
    </group>
  )
}

interface SmoothButtonProps {
  texture: THREE.Texture
  onClick: () => void
  position: [number, number, number]
  size: [number, number]
  text?: string
  fontPath: string
}

const SmoothButton = ({ texture, onClick, position, size, text, fontPath }: SmoothButtonProps) => {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const targetY    = hovered ? position[1] + 0.007 : position[1]
  const targetRotZ = hovered ? 0.015 : 0

  useFrame((_, delta) => {
    const t = delta * 12
    if (groupRef.current) {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, t)
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, t)
      groupRef.current.scale.set(1, 1, 1)
    }
  })

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshBasicMaterial color="#e0e0e0" map={texture} transparent alphaTest={0.1} />
      </mesh>
      {text && (
        <Text
          renderOrder={1}
          position={[0, 0.005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.06}
          color="#333333"
          font={fontPath}
          anchorX="center"
          anchorY="middle"
        >
          {text}
        </Text>
      )}
    </group>
  )
}

interface MessagePaperProps {
  position?: [number, number, number]
  onSend?: (data: { message: string; email: string; subject: string }) => void
}

export function MessagePaper({ position = [0, 0.05, 2], onSend }: MessagePaperProps) {
  const groupRef   = useRef<THREE.Group>(null)
  const paperRef   = useRef<THREE.Mesh>(null)
  const hiddenInputRef   = useRef<HTMLTextAreaElement>(null)
  const emailInputRef    = useRef<HTMLInputElement>(null)
  const subjectInputRef  = useRef<HTMLInputElement>(null)

  const [message,      setMessage]      = useState('')
  const [email,        setEmail]        = useState('')
  const [subject,      setSubject]      = useState('')
  const [activeField,  setActiveField]  = useState<string | null>(null)
  const [cursorVisible,setCursorVisible] = useState(true)
  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null)

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!email.trim()) newErrors.email = 'Email required'
    else if (!isValidEmail(email)) newErrors.email = 'Invalid email'
    if (!subject.trim()) newErrors.subject = 'Subject required'
    if (!message.trim()) newErrors.message = 'Message required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const paperTexture  = useTexture('/textures/contact/paper_form.webp')
  const buttonTexture = useTexture('/textures/contact/send_button.webp')

  useEffect(() => {
    if (paperTexture)  paperTexture.colorSpace  = THREE.SRGBColorSpace
    if (buttonTexture) buttonTexture.colorSpace = THREE.SRGBColorSpace
  }, [paperTexture, buttonTexture])

  useEffect(() => {
    if (!activeField) { setCursorVisible(false); return }
    const interval = setInterval(() => setCursorVisible(p => !p), 530)
    return () => clearInterval(interval)
  }, [activeField])

  const handlePaperClick = useCallback((e: { stopPropagation: () => void; uv?: THREE.Vector2 }) => {
    e.stopPropagation()
    const uv = (e as { uv?: THREE.Vector2 }).uv
    if (!uv) return
    const uvY = uv.y
    if (uvY > 0.82) { setActiveField('email');   setTimeout(() => emailInputRef.current?.focus(),   10) }
    else if (uvY > 0.68) { setActiveField('subject'); setTimeout(() => subjectInputRef.current?.focus(), 10) }
    else if (uvY > 0.18) { setActiveField('message'); setTimeout(() => hiddenInputRef.current?.focus(),  10) }
  }, [])

  const handleButtonClick = useCallback(async () => {
    setSubmitStatus(null)
    if (!validateForm()) return
    setIsSubmitting(true)
    setErrors({})
    try {
      // Open mailto as fallback instead of API call
      window.open(
        `mailto:fengyibinapply@163.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`From: ${email}\n\n${message}`)}`,
        '_blank'
      )
      setSubmitStatus('success')
      onSend?.({ message, email, subject })
      setMessage(''); setEmail(''); setSubject('')
    } catch {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, email, subject, onSend])

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      const active = document.activeElement
      if (active !== hiddenInputRef.current && active !== emailInputRef.current && active !== subjectInputRef.current) {
        setActiveField(null)
      }
    }, 100)
  }, [])

  const formattedMessage = useMemo(() => {
    const maxCharsPerLine = 28
    const maxLines = 10
    const lines: string[] = []
    const words = message.split(' ')
    let currentLine = ''
    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim()
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    })
    if (currentLine) lines.push(currentLine)
    return lines.slice(0, maxLines).join('\n')
  }, [message])

  useFrame((state) => {
    if (!paperRef.current) return
    paperRef.current.rotation.z = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.005
  })

  return (
    <group ref={groupRef} position={position}>
      <Html position={[0, 0, 0]} style={{ position: 'fixed', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <textarea ref={hiddenInputRef} value={message} onChange={e => { if (e.target.value.length <= 300) setMessage(e.target.value) }} onBlur={handleBlur} aria-label="Message" style={{ pointerEvents: 'auto' }} />
        <input ref={emailInputRef}   type="email" value={email}   onChange={e => { if (e.target.value.length <= 50) setEmail(e.target.value) }}   onBlur={handleBlur} aria-label="Email"   style={{ pointerEvents: 'auto' }} />
        <input ref={subjectInputRef} type="text"  value={subject} onChange={e => { if (e.target.value.length <= 50) setSubject(e.target.value) }} onBlur={handleBlur} aria-label="Subject" style={{ pointerEvents: 'auto' }} />
      </Html>

      <mesh ref={paperRef} rotation={[-Math.PI / 2, 0, 0]} onClick={handlePaperClick as unknown as (e: React.MouseEvent) => void}>
        <planeGeometry args={[PAPER_WIDTH, PAPER_HEIGHT, 20, 20]} />
        <meshBasicMaterial color="#e0e0e0" map={paperTexture} transparent alphaTest={0.5} side={THREE.FrontSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PAPER_WIDTH, PAPER_HEIGHT, 20, 20]} />
        <meshBasicMaterial color="#f5f5f0" side={THREE.BackSide} />
      </mesh>

      <InteractiveTextField isActive={activeField === 'email'} value={email} placeholder="email..." cursor={cursorVisible ? '|' : ' '} onClick={() => { setActiveField('email'); setTimeout(() => emailInputRef.current?.focus(), 10) }} position={[-0.5, 0.008, -0.61]} baseRotation={[-Math.PI / 2, 0, 0.02]} hitboxPosition={[0, 0.005, -0.61]} hitboxSize={[PAPER_WIDTH * 0.85, 0.08]} fontSize={0.05} maxWidth={PAPER_WIDTH * 0.8} fontPath={FONT_PATH} />
      <InteractiveTextField isActive={activeField === 'subject'} value={subject} placeholder="subject..." cursor={cursorVisible ? '|' : ' '} onClick={() => { setActiveField('subject'); setTimeout(() => subjectInputRef.current?.focus(), 10) }} position={[-0.5, 0.008, -0.46]} baseRotation={[-Math.PI / 2, 0, 0.02]} hitboxPosition={[0, 0.005, -0.46]} hitboxSize={[PAPER_WIDTH * 0.85, 0.08]} fontSize={0.05} maxWidth={PAPER_WIDTH * 0.8} fontPath={FONT_PATH} />
      <InteractiveTextField isActive={activeField === 'message'} value={formattedMessage} placeholder="message..." cursor={cursorVisible ? '|' : ' '} onClick={() => { setActiveField('message'); setTimeout(() => hiddenInputRef.current?.focus(), 10) }} position={[-0.46, 0.008, -0.3]} baseRotation={[-Math.PI / 2, 0, 0.02]} hitboxPosition={[0, 0.005, 0.1]} hitboxSize={[PAPER_WIDTH * 0.85, 0.55]} fontSize={0.045} maxWidth={PAPER_WIDTH * 0.75} fontPath={FONT_PATH} anchorY="top" textAlign="left" lineHeight={1.35} />

      <SmoothButton texture={buttonTexture} onClick={handleButtonClick} position={[0, 0.005, 0.68]} size={[0.5, 0.13]} text={isSubmitting ? 'SENDING...' : 'SEND'} fontPath={FONT_PATH} />

      {Object.keys(errors).length > 0 && (
        <Text position={[0, 0.01, 0.55]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.035} color="#cc3333" font={FONT_PATH} anchorX="center" anchorY="middle">
          {errors.email || errors.subject || errors.message}
        </Text>
      )}
      {submitStatus === 'success' && (
        <Text position={[0, 0.02, 0.55]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.045} color="#22aa44" font={FONT_PATH} anchorX="center" anchorY="middle">
          Message sent! ✓
        </Text>
      )}
      {submitStatus === 'error' && (
        <Text position={[0, 0.02, 0.55]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.04} color="#cc3333" font={FONT_PATH} anchorX="center" anchorY="middle">
          Failed. Try again.
        </Text>
      )}
    </group>
  )
}
