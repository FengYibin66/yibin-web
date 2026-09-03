import type { GalleryRoom as GalleryRoomType, GalleryImage } from '@/lib/gallery/data'
import { ArtworkFrame } from './ArtworkFrame'

interface GalleryRoomProps {
  room: GalleryRoomType
  /** 展厅序号（0 起）。用于页头的 "Gallery 01" —— 见下方注释 */
  index: number
  onExpand: (image: GalleryImage) => void
}

export function GalleryRoom({ room, index, onExpand }: GalleryRoomProps) {
  return (
    <div className="gallery-room relative flex-shrink-0 h-screen flex flex-col">
      {/* Room header */}
      <div className="flex items-end px-16 pt-16 pb-8">
        <div>
          <div
            className="text-xs uppercase tracking-[0.3em] mb-1"
            style={{ color: '#8b7355', fontFamily: 'var(--font-gallery, Georgia, serif)' }}
          >
            {/* 原为 String(room.id).padStart(2,'0')——id 是 'iceland' 这类
                字符串，padStart 对它无效，于是页头显示 "GALLERY ICELAND"
                而不是 "Gallery 01"（审计 F2）。序号该来自位置，不是 id。 */}
            Gallery {String(index + 1).padStart(2, '0')}
          </div>
          <h2
            className="text-4xl font-light"
            style={{ color: '#2a1f0e', fontFamily: 'var(--font-gallery, Georgia, serif)' }}
          >
            {room.title}
          </h2>
          <p className="text-sm mt-1" style={{ color: '#6b5a3e', fontFamily: 'var(--font-gallery, Georgia, serif)', fontStyle: 'italic' }}>
            {room.subtitle} · {room.year}
          </p>
        </div>
      </div>

      {/* Artworks row — centered vertically */}
      <div className="flex-1 flex items-center gap-10 px-16 overflow-visible">
        {room.images.map((img, i) => (
          <ArtworkFrame key={img.src} image={img} index={i} onExpand={onExpand} />
        ))}
      </div>

      {/* Floor gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #2a1f0e, transparent)' }}
      />

      {/* Room divider (doorway to next room) */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[1px]"
        style={{ background: 'linear-gradient(to bottom, transparent, #c8a96e55, transparent)' }}
      />
    </div>
  )
}
