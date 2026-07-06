type SoundName = 'door_hover' | 'door_open' | 'door_close'

class AudioManager {
  private sounds = new Map<SoundName, HTMLAudioElement>()
  private bgMusic: HTMLAudioElement | null = null
  private muted = false
  private volume = 0.4
  private initialized = false

  init(): void {
    if (this.initialized || typeof window === 'undefined') return
    this.initialized = true

    const soundFiles: Record<SoundName, string> = {
      door_hover: '/sounds/door_hover.mp3',
      door_open:  '/sounds/door_open.mp3',
      door_close: '/sounds/door_close.mp3',
    }
    for (const [name, path] of Object.entries(soundFiles)) {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.volume = this.volume
      this.sounds.set(name as SoundName, audio)
    }

    this.bgMusic = new Audio('/sounds/bg_corridor.ogg')
    this.bgMusic.loop = true
    this.bgMusic.volume = 0.2
    this.bgMusic.preload = 'auto'

    const saved = localStorage.getItem('lab_muted')
    if (saved === 'true') this.muted = true
  }

  play(name: SoundName): void {
    if (this.muted || typeof window === 'undefined') return
    const audio = this.sounds.get(name)
    if (!audio) return
    const clone = audio.cloneNode() as HTMLAudioElement
    clone.volume = this.volume
    clone.play().catch(() => {})
  }

  playBg(): void {
    if (!this.bgMusic || this.muted) return
    this.bgMusic.play().catch(() => {})
  }

  stopBg(): void {
    if (!this.bgMusic) return
    this.bgMusic.pause()
    this.bgMusic.currentTime = 0
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.bgMusic) this.bgMusic.muted = this.muted
    localStorage.setItem('lab_muted', String(this.muted))
    return this.muted
  }

  isMuted(): boolean { return this.muted }
}

export const audioManager = new AudioManager()
