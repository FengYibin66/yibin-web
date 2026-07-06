# Glassmorphism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Apple macOS-style glassmorphism to all cards on resume.yibinfeng.com via a single `.glass-card` CSS utility class.

**Architecture:** Define `.glass-card` in `globals.css` as the single source of truth for glass behavior (backdrop-filter + semi-transparent bg + white highlight border + depth shadows). Each card component adds `glass-card` to its className and removes the now-redundant opaque `background: var(--bg-surface)` inline style. ProjectCard and PublicationCard get component-specific glow overrides via their existing style props.

**Tech Stack:** Tailwind CSS v4, Next.js 14, React 18, CSS `backdrop-filter`

## Global Constraints

- `backdrop-filter` must include `-webkit-backdrop-filter` for Safari support
- Light theme override via `[data-theme="light"] .glass-card` in globals.css
- No new npm dependencies
- `pnpm --filter @yibin/resume type-check` must pass (0 errors) after every task
- Remove inline `style={{ background: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}` from components that adopt `.glass-card` — the class replaces those styles

---

### Task 1: Add `.glass-card` to globals.css

**Files:**
- Modify: `apps/resume/app/globals.css`

**Interfaces:**
- Produces: `.glass-card` CSS class available globally; `.glass-card:hover` variant; `[data-theme="light"] .glass-card` override

- [ ] **Step 1: Read the current end of globals.css**

```bash
tail -30 apps/resume/app/globals.css
```

- [ ] **Step 2: Append the glass-card block at the end of the file**

Add after the existing `@keyframes scanline` block:

```css
/* ============================================================
   Glassmorphism — Apple macOS style
   Apply via className="glass-card" on any card root element.
   Replaces opaque bg-surface + bg-border inline styles.
   ============================================================ */
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
  transition:
    background 0.2s ease,
    border-top-color 0.2s ease,
    box-shadow 0.2s ease;
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

[data-theme="light"] .glass-card:hover {
  background: rgba(255, 255, 255, 0.8);
}
```

- [ ] **Step 3: Verify type-check passes**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_web
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```
Expected: no output (clean exit)

- [ ] **Step 4: Commit**

```bash
git add apps/resume/app/globals.css
git commit -m "feat(glass): add .glass-card utility class to globals.css

backdrop-filter blur(20px) + white highlight border + depth shadows.
Includes :hover variant and [data-theme=light] override.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Apply glass-card to StatCard

**Files:**
- Modify: `apps/resume/components/ui/StatCard.tsx`

**Interfaces:**
- Consumes: `.glass-card` from Task 1

- [ ] **Step 1: Read the current StatCard**

```bash
cat apps/resume/components/ui/StatCard.tsx
```

- [ ] **Step 2: Update the component**

Find the root `<div>` that has:
```tsx
className="rounded-xl p-6 text-center border"
style={{ background: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}
```

Replace with:
```tsx
className="glass-card rounded-xl p-6 text-center"
```
Remove the `style` prop entirely — `.glass-card` provides background and border.

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add apps/resume/components/ui/StatCard.tsx
git commit -m "feat(glass): apply glass-card to StatCard

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Apply glass-card to TimelineItem

**Files:**
- Modify: `apps/resume/components/ui/TimelineItem.tsx`

**Interfaces:**
- Consumes: `.glass-card` from Task 1

- [ ] **Step 1: Read the current TimelineItem**

```bash
cat apps/resume/components/ui/TimelineItem.tsx
```

- [ ] **Step 2: Update the card div**

Find the card content `<div>` that uses:
```tsx
style={{ background: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}
```
or a `className` with `border` and inline style for background.

Add `glass-card` to its `className` and remove the opaque background/border inline styles. Keep all other classes (padding, rounded, etc.).

Example — if the card div currently is:
```tsx
<div className="rounded-xl p-5 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}>
```
Change to:
```tsx
<div className="glass-card rounded-xl p-5">
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add apps/resume/components/ui/TimelineItem.tsx
git commit -m "feat(glass): apply glass-card to TimelineItem

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Apply glass-card to ProjectCard with cyan glow

**Files:**
- Modify: `apps/resume/components/ui/ProjectCard.tsx`

**Interfaces:**
- Consumes: `.glass-card` from Task 1

- [ ] **Step 1: Read the current ProjectCard**

```bash
cat apps/resume/components/ui/ProjectCard.tsx
```

- [ ] **Step 2: Update the card root**

Find the outermost card `<div>` (the one with `ref={cardRef}` for the tilt effect). It currently has something like:
```tsx
className="rounded-xl p-5 border transition-colors duration-200 cursor-pointer"
style={{ background: 'var(--bg-surface)', borderColor: 'var(--bg-border)', transition: '...' }}
```

Change to:
```tsx
className="glass-card rounded-xl p-5 cursor-pointer"
style={{ transition: 'transform 0.1s ease, background 0.2s ease, border-top-color 0.2s ease, box-shadow 0.2s ease' }}
```

Note: keep the `transition` style prop because GSAP tilt uses `transform` and we need to merge transitions. Remove background and borderColor from the style prop.

- [ ] **Step 3: Add cyan glow on hover via onMouseEnter/Leave**

In the existing `handleMove` function (mousemove handler for tilt), the card already has GSAP controlling transform. After the `gsap.to(card, {...})` call in `handleMove`, the card's box-shadow should intensify.

Find the `handleLeave` function. Add a subtle cyan glow on enter and remove on leave using direct style manipulation (not GSAP, to keep it simple):

```tsx
const handleEnter = () => {
  if (card) card.style.boxShadow = [
    'inset 0 1px 0 rgba(255,255,255,0.08)',
    '0 8px 32px rgba(0,0,0,0.45)',
    '0 1px 2px rgba(0,0,0,0.6)',
    '0 0 0 1px rgba(0,212,255,0.15)',
    '0 0 20px rgba(0,212,255,0.08)',
  ].join(', ')
}
const handleLeave = () => {
  if (card) {
    card.style.transform = 'none'
    card.style.boxShadow = ''  // revert to .glass-card CSS
  }
}
```

Add `card.addEventListener('mouseenter', handleEnter)` in the `useEffect`, and remove it in the cleanup.

- [ ] **Step 4: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
git add apps/resume/components/ui/ProjectCard.tsx
git commit -m "feat(glass): apply glass-card to ProjectCard with cyan glow on hover

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Apply glass-card to PublicationCard with indigo glow

**Files:**
- Modify: `apps/resume/components/ui/PublicationCard.tsx`

**Interfaces:**
- Consumes: `.glass-card` from Task 1

- [ ] **Step 1: Read the current PublicationCard**

```bash
cat apps/resume/components/ui/PublicationCard.tsx
```

- [ ] **Step 2: Update all card root divs**

PublicationCard has two variants (featured and standard). For both, find the outermost card `<div>` with border/bg styles and add `glass-card`.

For the **featured** variant, also add an indigo ambient glow via `style`:
```tsx
// featured card root:
className="glass-card rounded-xl overflow-hidden"
style={{
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.08)',
    '0 8px 32px rgba(0,0,0,0.45)',
    '0 1px 2px rgba(0,0,0,0.6)',
    '0 0 40px rgba(99,102,241,0.1)',
  ].join(', ')
}}
```

For the **standard** variant, just add `glass-card` and remove the opaque bg/border styles:
```tsx
className="glass-card rounded-xl p-5"
```

Remove existing `ring-*` classes if they conflict visually (`.glass-card` already provides border). If the rings are used for sizing/layout, check and decide case by case.

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add apps/resume/components/ui/PublicationCard.tsx
git commit -m "feat(glass): apply glass-card to PublicationCard, indigo glow on featured

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Apply glass-card to About section education cards

**Files:**
- Modify: `apps/resume/components/sections/AboutSection.tsx`

**Interfaces:**
- Consumes: `.glass-card` from Task 1

- [ ] **Step 1: Read the education card section**

```bash
grep -n "edu-card\|bg-surface\|bg-border\|rounded-lg" apps/resume/components/sections/AboutSection.tsx | head -20
```

- [ ] **Step 2: Update education card divs**

Find the education card `<div>` that currently uses:
```tsx
className="rounded-lg px-4 py-3 border"
style={{ background: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}
```

Change to:
```tsx
className="glass-card edu-card rounded-lg px-4 py-3"
```
Remove the inline `style` for background and border. Keep `edu-card` class (used for GSAP animation targeting).

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```

- [ ] **Step 4: Final build verification**

```bash
pnpm --filter @yibin/resume build 2>&1 | tail -8
```
Expected: all routes build successfully, no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/resume/components/sections/AboutSection.tsx
git commit -m "feat(glass): apply glass-card to About section education cards

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Visual verification

- [ ] **Step 1: Start dev server in background**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_web
pnpm --filter @yibin/resume dev &
sleep 8
```

- [ ] **Step 2: Verify pages return 200**

```bash
curl -s -o /dev/null -w "main: %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "gallery: %{http_code}\n" http://localhost:3000/gallery
```
Expected: both `200`

- [ ] **Step 3: Verify glass-card is in rendered HTML**

```bash
curl -s http://localhost:3000/ | grep -c "glass-card"
```
Expected: number > 0

- [ ] **Step 4: Stop dev server and clean ports**

```bash
pkill -f "next dev -p 3000" 2>/dev/null || true
sleep 1
for port in 3000 3001 5173; do lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null; done
echo "ports cleared"
```
