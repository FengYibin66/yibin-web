# Glassmorphism Design Spec — resume.yibinfeng.com

**Date:** 2026-07-07  
**Style:** Apple macOS风 — deep dark background + semi-transparent cards + white highlight border

---

## Design Tokens (unchanged)

Existing tokens remain. No token changes needed.

- `--bg-base: #070b12` — deep background, enables real blur effect
- `--bg-surface: #0d1220` — base for rgba calculations
- `--bg-border: #1e2740` — replaced by rgba white border in glass-card

---

## Core: `.glass-card` utility class

Defined in `globals.css`. Single source of truth for glass behavior.

```css
.glass-card {
  background: rgba(13, 18, 32, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-top-color: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 32px rgba(0, 0, 0, 0.45),
    0 1px 2px rgba(0, 0, 0, 0.6);
}

.glass-card:hover {
  background: rgba(13, 18, 32, 0.65);
  border-top-color: rgba(255, 255, 255, 0.2);
}

[data-theme="light"] .glass-card {
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-top-color: rgba(255, 255, 255, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 4px 16px rgba(0, 0, 0, 0.08);
}
```

---

## Per-component overrides

| Component | Base | Extra |
|-----------|------|-------|
| `StatCard` | `.glass-card` | none |
| `TimelineItem` | `.glass-card` | none |
| `ProjectCard` | `.glass-card` | cyan border glow on hover |
| `PublicationCard` featured | `.glass-card` | indigo ambient glow |
| `PublicationCard` standard | `.glass-card` | none |
| About education cards | `.glass-card` | none |

### ProjectCard cyan glow
```css
/* On the card root when hovered */
box-shadow: ...(glass-card base)..., 0 0 0 1px rgba(0,212,255,0.15);
```
Implemented via `style` prop since it composites with existing tilt transform.

### PublicationCard featured indigo glow
```css
box-shadow: ...(glass-card base)..., 0 0 32px rgba(99,102,241,0.1);
```

---

## Files changed

1. `apps/resume/app/globals.css` — add `.glass-card` block
2. `apps/resume/components/ui/StatCard.tsx` — add `glass-card` to className
3. `apps/resume/components/ui/TimelineItem.tsx` — add `glass-card` to card div
4. `apps/resume/components/ui/ProjectCard.tsx` — add `glass-card`, adjust box-shadow
5. `apps/resume/components/ui/PublicationCard.tsx` — add `glass-card`, featured gets indigo glow
6. `apps/resume/components/sections/AboutSection.tsx` — add `glass-card` to edu cards

## Not changed

- `HeroSection` — text overlay, no card background needed
- `Navbar` — already has `backdrop-blur`
- `GlowButton` — button, not a card
