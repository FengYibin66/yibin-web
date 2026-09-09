'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useScene } from '@/context/SceneContext'
import { useAudio } from '@/context/AudioContext'
import { useAchievementActions } from '@/context/AchievementsContext'
import type { RoomId } from '@/context/SceneContext'
import { AchievementPopup } from './AchievementPopup'
import { EdgeItem } from '@/components/layout/EdgeLayer'
import { useViewport } from '@/hooks/useViewport'
import { AchievementsPanel } from './AchievementsPanel'
import { TUTORIAL_OPEN_EVENT } from '@/lib/lab/tutorialStorage'
import { useLabLabels } from '@/hooks/useLabLabels'
import { useLocale } from '@/hooks/useLocale'
import { nextLocaleLabel } from '@/lib/content/localeToggle'
import { pushEscapeConsumer } from '@/lib/lab/app/escapeStack'
import { ROOM_IDS } from '@/lib/lab/domain/ids'
import { useCorridorStore } from '@/lib/lab/app/stores/corridorStore'
import { useTour } from '@/hooks/useTour'
import { isLabLoaded, onLabLoaded } from '@/lib/lab/app/labLoaded'

/*
  地图里的房间名来自 `labUi.doors`，与走廊门牌是同一份（审计 E7）。

  这里原先是第三张硬编码英文表（前两张在 CorridorSegment 与
  RoomLoadingIndicator）。同一个房间名有三份拷贝的直接后果是：改了一处、
  另两处不跟着改，而且它们全是英文。
*/

export function NavigationUI() {
  const {
    hasEntered,
    isInRoom,
    currentRoom,
    requestExit,
    teleportTo,
    isTeleporting,
    roomLoadState,
    teleportPhase,
  } = useScene()
  const { isMuted, toggleMute, sfxVolume, setSfxVolume, bgmVolume, setBgmVolume } = useAudio()
  const { showTutorial, unlockAchievement } = useAchievementActions()
  const labels = useLabLabels()
  const { locale, toggle: toggleLocale } = useLocale()

  const [mapOpen, setMapOpen]               = useState(false)
  /* 招聘官路线（ADR 20260908204302）：互斥归状态机、运动归导轨，这里只有按钮与字幕 */
  const tour = useTour()
  /* 走廊教程要等纸撕开再提——"点一扇门"在门还没画出来时是错的（产品评审） */
  const [labLoaded, setLabLoaded] = useState(isLabLoaded)
  useEffect(() => onLabLoaded(() => setLabLoaded(true)), [])
  /*
    地图上"这间去过没有"的来源（ADR 20260908172231）。用 `inked`（真的进过）
    而不是 `visited`（从门口路过）—— 地图要回答的是"还有哪些内容没看"。
  */
  const visitedRooms = useCorridorStore(state => state.inked)
  /** 动效开关的实际取值，作为诊断属性暴露（见下方 `data-lab-motion`） */
  const motionScale = useCorridorStore(state => state.motionScale)
  const [audioOpen, setAudioOpen]           = useState(false)
  const [achievementsOpen, setAchievementsOpen] = useState(false)
  const [isExiting, setIsExiting]           = useState(false)
  const [isUIHidden, setIsUIHidden]         = useState(false)
  /** 窄屏「更多」面板。窄屏判据走 useViewport（门禁 viewportReaders.test.ts） */
  const [moreOpen, setMoreOpen]             = useState(false)

  const mapPanelRef  = useRef<HTMLDivElement>(null)
  const mapCloseRef  = useRef<HTMLButtonElement>(null)
  const canTeleport =
    roomLoadState.phase === 'idle' || roomLoadState.phase === 'entered'
  const isRoomNavigationDisabled = isTeleporting || !canTeleport

  /*
    走廊的两条提示。作用域是 `corridor`：进任何房间时由 `enterScope` 整批出队
    （ADR 20260903211302）。

    在此之前它们和房间教程混在同一个无作用域的队列里，于是「走廊提示」会在
    房间里继续排队占位——`Scroll or swipe to explore` 那条尤其明显：它只能被
    滚轮解锁，键盘用户永远关不掉它。
  */
  useEffect(() => {
    if (!labLoaded || tour.running) return // 纸没撕开不提；路线中"教你怎么操作"自相矛盾
    if (!hasEntered && !isTeleporting) {
      showTutorial('corridor_enter', 'corridor')
    } else if (hasEntered && !isTeleporting && !isInRoom) {
      showTutorial('corridor_explore', 'corridor')
      /*
        这里曾经再排一条"按脚印带你走"。它挤掉了原有的教程队列——「开始探索」关掉说明后
        立刻又冒一条（那条 E2E 断言关掉后为 0），退房后房间教程也被它占位。
        路线的入口改由按钮自己表达（实心反白 + aria-label，UX 评审的建议），不再占教程通道；
        `tour_complete` 仍是成就，文案在成就面板里用。
      */
    }
  }, [labLoaded, tour.running, hasEntered, isTeleporting, isInRoom, showTutorial])

  // Close panels when teleporting or in room
  useEffect(() => {
    if (isInRoom || isTeleporting) {
      setMapOpen(false)
      setAudioOpen(false)
      setAchievementsOpen(false)
      setIsExiting(false)
    }
  }, [isInRoom, isTeleporting])

  useEffect(() => {
    if (!isInRoom) setIsExiting(false)
  }, [isInRoom])

  // Inspect event hides UI (e.g. when a painting is inspected)
  useEffect(() => {
    const handleInspectChange = (e: CustomEvent<boolean>) => {
      setIsUIHidden(e.detail)
      if (e.detail) {
        setMapOpen(false)
        setAudioOpen(false)
        setAchievementsOpen(false)
      }
    }
    window.addEventListener('inspectChange', handleInspectChange as EventListener)
    return () => window.removeEventListener('inspectChange', handleInspectChange as EventListener)
  }, [])

  // Focus management for map panel
  useEffect(() => {
    if (mapOpen) setTimeout(() => mapCloseRef.current?.focus(), 100)
  }, [mapOpen])

  // Focus trap for map panel
  const handleMapKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !mapPanelRef.current) return
    const focusable = mapPanelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }, [])

  const handleRoomClick = useCallback((roomId: RoomId) => {
    if (roomId === currentRoom || isRoomNavigationDisabled) return
    setMapOpen(false)
    setAudioOpen(false)
    setAchievementsOpen(false)
    teleportTo(roomId)
  }, [currentRoom, isRoomNavigationDisabled, teleportTo])

  const handleBackClick = useCallback(() => {
    if (isTeleporting) return
    setIsExiting(true)
    requestExit()
  }, [isTeleporting, requestExit])

  const viewport = useViewport()
  // 视口未判定（SSR / 首帧）时按宽屏渲染：窄屏上多显示四个图标一帧，
  // 比反过来（宽屏上先折叠再展开）跳动小。
  const isNarrow = viewport?.isNarrow ?? false

  const closeAll = useCallback(() => {
    setMapOpen(false)
    setAudioOpen(false)
    setAchievementsOpen(false)
    setMoreOpen(false)
  }, [])

  /*
    ESC 关面板 —— 通过**认领消费栈**，而不是自己挂 window 监听。

    自己挂监听时，在房间里按 ESC 会同时关面板 + 让房间退场（两个监听互不知情，
    且这个监听的依赖是 `[mapOpen, audioOpen, achievementsOpen]`，每次开关面板都会
    摘掉重挂，于是它在 window 监听队列里的位置随用户操作漂移——"谁先执行"变成了
    不可预期的事）。认领之后 ESC 由 `useEscapeRouter` 统一路由：栈顶先消费，
    消费掉就不再往下走到"退出房间"。

    只在**有面板打开**时认领：常驻认领会把走廊里那次"没人认领 → 什么也不做"
    的 ESC 也吞掉，将来加别的 ESC 语义时会撞。
  */
  const anyPanelOpen = mapOpen || audioOpen || achievementsOpen || moreOpen
  useEffect(() => {
    if (!anyPanelOpen) return
    return pushEscapeConsumer(closeAll)
  }, [anyPanelOpen, closeAll])

  if (!hasEntered) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}
      /*
        E2E 的状态出口。这几个属性是**唯一**能让 Playwright 知道 Lab 处于什么
        状态的东西——门是 R3F 里的 mesh，不在 DOM 里；而 aria-label 全是本地化
        的，不能用来定位（LocaleToggle 那次三个 E2E 一起红就是这个原因）。

        用 data 属性而不是再挂一个 window 钩子：DOM 属性能被 Playwright 的
        `toHaveAttribute` 直接等待，不需要 `waitForFunction` 轮询。
      */
      data-testid="lab-ui"
      data-lab-room={currentRoom ?? ''}
      data-lab-in-room={isInRoom}
      data-lab-teleporting={isTeleporting}
      /* 传送的纸动画相位。诊断"传送卡住"时唯一能分辨卡在哪一步的信息 */
      data-lab-teleport-phase={teleportPhase ?? ''}
      data-lab-phase={roomLoadState.phase}
      /*
        动效开关的实际取值（ADR 20260908172231）。0 = 系统要求减少动效。
        没有它就无法验证"reduced 下持续动画真的停了"——截图比较受相机插值
        尾巴干扰（整幅画面平移 0.1 像素会让大量子像素变化），而 3D 物体的
        transform 不在 DOM 里。实测排查这件事时就卡在这里。
      */
      data-lab-motion={motionScale}
    >
      {/*
        成就气泡进 `bottom-center` 槽位，与滚动提示成为兄弟。
        它原先在 globals.css 里写死 `bottom: 88px`，注释逐字写着
        「88 = 32（提示的底距）+ 提示自身高度（约 20）+ 一段间距」——
        那个手算的数现在没了（ADR 20260909182319 举的原型例子）。
      */}
      <EdgeItem id="lab-achievement">
        <AchievementPopup />
      </EdgeItem>

      {/* 路线字幕：每站一句（规格 lab-corridor-story.md §5.1） */}
      {tour.caption && (
        <div
          role="status"
          data-testid="tour-caption"
          data-tour-stop={tour.stopId ?? ''}
          style={{
            /*
              像字幕，不像第二张成就纸卡：深底浅字、无描边、无斜角，在明暗与形状上与
              成就 / 教程气泡（白底纸卡，bottom ≈ 90–150）一眼分开，且在它们之上（UX 评审）。
            */
            position: 'absolute',
            bottom: 230,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 'min(640px, 88vw)',
            padding: '10px 20px',
            background: 'rgba(42,31,14,0.84)',
            color: '#fffdf7',
            borderRadius: 6,
            fontFamily: 'var(--font-sketch)',
            fontSize: 20,
            lineHeight: 1.35,
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 120,
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
          }}
        >
          {tour.running && (
            <span style={{ fontSize: 13, opacity: 0.6, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
              {tour.index}/{tour.total}
            </span>
          )}
          <span>{labels.tour[tour.caption]}</span>
        </div>
      )}

      {/*
        房间内的返回按钮。与走廊的「← 退出 Lab」同槽位、同 order，
        靠 `in-room` / `not-in-room` 互斥——这个约定原先只活在两个 JSX 条件里，
        没有任何地方声明过它，于是也没有任何东西能断言它。
      */}
      <EdgeItem id="lab-room-back" visible={isInRoom}>
        <button
          onClick={handleBackClick}
          disabled={isTeleporting}
          aria-disabled={isTeleporting}
          style={{
            background: 'rgba(255,255,255,0.9)',
            border: '1.5px solid rgba(42,31,14,0.15)',
            borderRadius: 6,
            // 触摸目标 44：原先 `padding: 8px 14px` + 13px 字 = 高 33px。
            minHeight: 44,
            padding: '0 14px',
            fontFamily: 'var(--font-sketch-bold)',
            fontSize: 13,
            color: '#2a1f0e',
            cursor: isTeleporting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            letterSpacing: '0.05em',
            opacity: isExiting || isTeleporting ? 0.5 : 1,
            transition: 'opacity 0.3s ease',
          }}
          aria-label={labels.loading.backToCorridor}
          data-testid="nav-back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {labels.hints.back}
        </button>
      </EdgeItem>

      {/*
        导航图标排。进 `top-bar` 槽位的右端，与左端的退出/返回是 flex 兄弟。

        原先它是 `absolute (16,16)`、退出链接是 `fixed (20,20)`——**两个不同的角**，
        谁也不知道对方多宽。320px 上实测：退出占 20→104、这排占 24→304，重叠 80px。
        「同槽位是兄弟所以不重叠」对跨角情形不成立，所以才有 `col: 'stretch'` 这个槽位。
      */}
      <EdgeItem id="lab-nav">
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          opacity: isUIHidden ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        {/* 带我走一遍 / 停止。加载完成前不显示（路线要导轨可用，状态机在 loading 会拒绝）；
            房间里与传送中不显示（状态机那时也不会接受 TOUR_START） */}
        {labLoaded && !isInRoom && !isTeleporting && (
          <NavButton
            onClick={() => {
              if (tour.running) { tour.stop(); return }
              closeAll()
              void tour.start()
            }}
            active={tour.running}
            solid={tour.running}
            aria-label={tour.running ? labels.panels.stopTour : labels.panels.tour}
            aria-pressed={tour.running}
            data-testid="nav-tour"
          >
            {/* 一只小脚印：一个掌垫 + 三个脚趾，18 px 里再多就成一团灰点（UX 评审） */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <ellipse cx="12" cy="15.5" rx="4.4" ry="5.2" />
              <circle cx="6.6" cy="8.6" r="2" /><circle cx="12" cy="6.4" r="2" /><circle cx="17.4" cy="8.6" r="2" />
            </svg>
          </NavButton>
        )}

        {/* Map button */}
        <NavButton
          onClick={() => { setMapOpen(o => !o); setAudioOpen(false); setAchievementsOpen(false) }}
          active={mapOpen}
          aria-label={labels.panels.openMap}
          aria-expanded={mapOpen}
          data-testid="nav-map"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </NavButton>

        {/*
          窄屏只留「路线 + 地图 + 更多」三个。

          为什么必须收：320px 上六个 40px 图标加间距是 280px，退出链接 84px，
          两者相加 364 > 320——这才是那 80px 重叠的**根因**，收进同一个槽位
          只能把「重叠」变成「挤压」，修不了「放不下」。而把触摸目标提到 44
          会让这排变成 6×44+5×8 = 304，一个人就吃掉整个视口。
          所以**收编与放大触摸目标是同一件事的两半，不能分批**。

          留下的两个是按「进了走廊之后最可能想干什么」选的：
          路线（用户点名要它更显眼）与地图（唯一的房间入口）。
          其余四个是设置类，藏一层不损失可达性——而且「更多」面板里它们有**文字**，
          比 18px 的图标更容易认。
        */}
        {!isNarrow && (
        <>
        {/* Audio button */}
        <NavButton
          onClick={() => { setAudioOpen(o => !o); setMapOpen(false); setAchievementsOpen(false) }}
          active={audioOpen}
          aria-label={labels.panels.audio}
          aria-expanded={audioOpen}
          data-testid="nav-audio"
        >
          {isMuted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
              <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
              <path d="M15 9a5 5 0 0 1 0 6" /><path d="M18 5a9 9 0 0 1 0 14" />
            </svg>
          )}
        </NavButton>

        {/* Achievements button */}
        <NavButton
          onClick={() => { setAchievementsOpen(o => !o); setMapOpen(false); setAudioOpen(false) }}
          active={achievementsOpen}
          aria-label={labels.panels.achievements}
          aria-expanded={achievementsOpen}
          data-testid="nav-achievements"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 21h8M12 17v4M7 4h10M5 4h14v5a7 7 0 0 1-7 7 7 7 0 0 1-7-7z" />
            <path d="M5 9H3V6h2" /><path d="M19 9h2V6h-2" />
          </svg>
        </NavButton>

        {/* Help button — reopens the controls tutorial */}
        <NavButton
          onClick={() => { closeAll(); window.dispatchEvent(new Event(TUTORIAL_OPEN_EVENT)) }}
          aria-label={labels.panels.help}
          data-testid="nav-help"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 9a3 3 0 1 1 4.6 2.5c-1 .6-1.6 1.2-1.6 2.5" />
            <circle cx="12" cy="17.5" r="0.5" fill="currentColor" />
          </svg>
        </NavButton>

        {/*
          语言切换。Lab 是全站唯一没有 Navbar 的视图，此前也是唯一切不了语言的
          地方——用户进了走廊看到门牌才想换语言，却得退回入口页。
          逻辑复用 `useLocale().toggle` 与 `nextLocaleLabel`（与 Classic 页的
          `LocaleToggle` 同一份规则），这里只是换成顶栏的按钮样式。
          文字与 aria-label 都随语言变，测试只能按 data-testid 定位。
        */}
        <NavButton
          onClick={() => { closeAll(); toggleLocale() }}
          aria-label={labels.panels.toggleLanguage}
          data-testid="nav-locale"
        >
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1 }}>
            {nextLocaleLabel(locale)}
          </span>
        </NavButton>
        </>
        )}

        {/* 窄屏：把音频 / 成就 / 帮助 / 语言收进「更多」。见 NARROW_KEEP 的注释 */}
        {isNarrow && (
          <NavButton
            onClick={() => { setMoreOpen(o => !o); setMapOpen(false); setAudioOpen(false); setAchievementsOpen(false) }}
            active={moreOpen}
            aria-label={labels.panels.more}
            aria-expanded={moreOpen}
            data-testid="nav-more"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
            </svg>
          </NavButton>
        )}
      </div>
      </EdgeItem>

      {/*
        窄屏「更多」面板：音频 / 成就 / 帮助 / 语言。

        它不是把四个图标竖着排一遍——面板里给的是**文字**。18px 的奖杯与问号
        在手机上要猜，而这四个是设置类功能、不是高频操作，多一次点击换来能读懂
        是划算的。（顶栏留下的两个反过来：路线与地图是高频，图标 + 一次点击更好。）

        样式与地图面板同源（`TORN_EDGE_CLIP`）：同一个视图里两种纸边会显得像 bug。
      */}
      {moreOpen && (
        <div
          role="dialog"
          aria-label={labels.panels.moreTitle}
          data-testid="more-panel"
          style={{
            position: 'absolute',
            top: 68, right: 12,
            width: 200,
            background: '#ffffff',
            padding: '12px 12px 16px',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'var(--font-sketch-bold)',
            pointerEvents: 'auto',
            zIndex: 100,
            clipPath: TORN_EDGE_CLIP,
            filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.12))',
          }}
        >
          <div style={{
            position: 'absolute', inset: '-20%',
            background: "url('/textures/paper-texture.webp') center center / cover",
            zIndex: -1,
          }} />

          {[
            {
              key: 'audio',
              label: labels.panels.audio,
              onClick: () => { setMoreOpen(false); setAudioOpen(true) },
              icon: <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />,
            },
            {
              key: 'achievements',
              label: labels.panels.achievements,
              onClick: () => { setMoreOpen(false); setAchievementsOpen(true) },
              icon: <path d="M8 21h8M12 17v4M5 4h14v5a7 7 0 0 1-7 7 7 7 0 0 1-7-7z" />,
            },
            {
              key: 'help',
              label: labels.panels.help,
              onClick: () => { closeAll(); window.dispatchEvent(new Event(TUTORIAL_OPEN_EVENT)) },
              icon: <path d="M9 9a3 3 0 1 1 4.6 2.5c-1 .6-1.6 1.2-1.6 2.5M12 17.5h.01" />,
            },
            {
              key: 'locale',
              label: nextLocaleLabel(locale),
              onClick: () => { closeAll(); toggleLocale() },
              icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" /></>,
            },
          ].map(row => (
            <button
              key={row.key}
              onClick={row.onClick}
              data-testid={`more-${row.key}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                // 44：面板里的行同样是触摸目标，不因为在面板里就可以更小
                minHeight: 44, padding: '0 4px',
                // 写死族名而不是 'inherit'：门禁 styleTokens.test.ts 要求每个
                // font-family 引用都能落到一条 @font-face 或系统字体上，
                // 'inherit' 让它无法验证（实测被抓）。
                fontFamily: 'var(--font-sketch-bold)', fontSize: 13, letterSpacing: '0.03em',
                color: '#2a1f0e', textAlign: 'left',
                position: 'relative', zIndex: 1,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                {row.icon}
              </svg>
              {row.label}
            </button>
          ))}
        </div>
      )}

      {/* Map panel — drops from top */}
      {mapOpen && (
        <div
          ref={mapPanelRef}
          onKeyDown={handleMapKeyDown}
          role="dialog"
          aria-label={labels.panels.map}
          data-testid="map-panel"
          style={{
            position: 'absolute',
            top: 0, right: 16,
            width: 280,
            background: '#ffffff',
            padding: '16px 16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            fontFamily: 'var(--font-sketch-bold)',
            pointerEvents: 'auto',
            zIndex: 100,
            clipPath: TORN_EDGE_CLIP,
            filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.12))',
          }}
        >
          {/* Paper texture */}
          <div style={{
            position: 'absolute', inset: '-20%',
            background: "url('/textures/paper-texture.webp') center center / cover",
            zIndex: -1,
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '2px dashed #bbb', position: 'relative', zIndex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '1.5px', color: '#1a1a1a' }}>{labels.panels.map}</h3>
            <button
              ref={mapCloseRef}
              onClick={() => setMapOpen(false)}
              aria-label={labels.panels.closeMap}
              data-testid="map-close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6,
                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                       // 触摸目标 44：原先只有 padding:4 包一个 16px 的图标 = 24×24，
                       // 是全 Lab 最小的可点元素。负外边距抵掉多出来的尺寸，标题行不变高。
                       minWidth: 44, minHeight: 44, margin: -10, marginLeft: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', zIndex: 1 }}>
            {ROOM_IDS.map(roomId => (
              <button
                key={roomId}
                onClick={() => handleRoomClick(roomId)}
                data-testid={`map-room-${roomId}`}
                /*
                  「这间去过没有」（ADR 20260908172231）。取自 `inked` 而不是
                  `visited`：地图要回答的是"还有哪些内容没看"，而 `visited`
                  只表示"从门口路过"。经过一扇门不等于看过里面。
                */
                data-visited={visitedRooms.has(`door-${roomId}`)}
                disabled={isRoomNavigationDisabled}
                aria-disabled={isRoomNavigationDisabled}
                style={{
                  background: currentRoom === roomId ? 'rgba(42,31,14,0.08)' : 'transparent',
                  border: '1px solid rgba(42,31,14,0.12)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sketch-bold)',
                  fontSize: 14,
                  color: '#1a1a1a',
                  cursor: isRoomNavigationDisabled ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em',
                  opacity: isRoomNavigationDisabled ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {currentRoom === roomId && (
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="4" fill="#1a1a1a" />
                  </svg>
                )}
                {labels.doors[roomId]}
                {/*
                  没进过的房间标一个手写问号 —— 与线稿风一致，也比挂锁诚实
                  （内容并没有被锁住，只是还没看）。已进过的不标，避免地图
                  变成一排图标。
                */}
                {!visitedRooms.has(`door-${roomId}`) && (
                  <span
                    aria-hidden
                    style={{
                      marginLeft: 'auto',
                      fontFamily: 'var(--font-sketch-bold)',
                      fontSize: 13,
                      /*
                        不加 `opacity`：`#6b5744` 本身在纸面板上是 4.6，乘 0.75
                        之后掉到 3.48，低于 WCAG AA 的 4.5 —— 对比度门禁
                        （`__tests__/labContrast.test.ts`，棘轮刻意留空）会直接红。
                        想让它更弱就换更浅的颜色并重新算，不要用透明度绕。
                      */
                      color: '#6b5744',
                    }}
                  >
                    ?
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audio panel */}
      {audioOpen && (
        <div
          style={{
            position: 'absolute',
            top: 56, right: 16,
            width: 240,
            background: '#ffffff',
            padding: '16px 16px 20px',
            fontFamily: 'var(--font-sketch-bold)',
            pointerEvents: 'auto',
            zIndex: 100,
            clipPath: `polygon(
              0% 0%, 100% 0%,
              98% 10%, 100% 20%, 97% 35%, 100% 50%, 98% 65%, 100% 80%, 97% 90%, 100% 100%,
              90% 97%, 80% 100%, 70% 96%, 60% 100%, 50% 97%, 40% 100%, 30% 96%, 20% 100%, 10% 97%, 0% 100%,
              2% 90%, 0% 80%, 3% 65%, 0% 50%, 2% 35%, 0% 20%, 3% 10%, 0% 0%
            )`,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))',
          }}
        >
          <div style={{ position: 'absolute', inset: '-20%', background: "url('/textures/paper-texture.webp') center center / cover", zIndex: -1 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '2px dashed #bbb' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '1.5px', color: '#1a1a1a' }}>{labels.panels.audio}</h3>
            <button onClick={() => setAudioOpen(false)} aria-label={labels.panels.closeAudio} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 44, minHeight: 44, margin: -10, marginLeft: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#444' }}>
                <span>{labels.panels.music}</span>
                <span>{Math.round(bgmVolume * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01"
                value={bgmVolume}
                onChange={e => setBgmVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#2a1f0e' }}
                aria-label={labels.panels.music}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#444' }}>
                <span>{labels.panels.sfx}</span>
                <span>{Math.round(sfxVolume * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01"
                value={sfxVolume}
                onChange={e => setSfxVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#2a1f0e' }}
                aria-label={labels.panels.sfx}
              />
            </div>

            <button
              onClick={toggleMute}
              style={{
                background: isMuted ? 'rgba(42,31,14,0.08)' : 'transparent',
                border: '1px solid rgba(42,31,14,0.2)',
                borderRadius: 6, padding: '8px 12px',
                fontFamily: 'var(--font-sketch-bold)',
                fontSize: 12, color: '#1a1a1a',
                cursor: 'pointer', letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {isMuted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
          </div>
        </div>
      )}

      {/* Achievements panel */}
      <AchievementsPanel isOpen={achievementsOpen} onClose={() => setAchievementsOpen(false)} />

      {/* Click-away overlay — z-index 50 keeps it below panels (100) and AchievementsPanel (95) */}
      {(mapOpen || audioOpen || achievementsOpen) && (
        <div
          style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', zIndex: 50 }}
          onClick={closeAll}
          aria-hidden
        />
      )}
    </div>
  )
}

// ─── Small reusable nav button ────────────────────────────────────────────────

/**
 * 撕纸边的裁剪路径。地图面板与窄屏「更多」面板共用——
 * 25 行的 polygon 抄第二份的话，改一处就会两个面板边缘不一样，
 * 而那种不一致只有把两个面板并排截图才看得出来。
 */
const TORN_EDGE_CLIP = `polygon(
    0% 0%, 100% 0%,
    99% 3%, 100% 6%, 98% 10%, 100% 14%, 99% 18%, 100% 22%, 98% 26%, 100% 30%,
    99% 35%, 100% 40%, 98% 45%, 100% 50%, 99% 55%, 100% 60%, 98% 65%, 100% 70%,
    99% 75%, 100% 80%, 98% 85%, 100% 90%, 99% 95%, 100% 100%,
    96% 99%, 92% 100%, 88% 98%, 84% 100%, 80% 99%, 76% 100%, 72% 98%, 68% 100%,
    64% 99%, 60% 100%, 56% 98%, 52% 100%, 48% 99%, 44% 100%, 40% 98%, 36% 100%,
    32% 99%, 28% 100%, 24% 98%, 20% 100%, 16% 99%, 12% 100%, 8% 98%, 4% 100%, 0% 99%,
    1% 95%, 0% 90%, 2% 85%, 0% 80%, 1% 75%, 0% 70%, 2% 65%, 0% 60%,
    1% 55%, 0% 50%, 2% 45%, 0% 40%, 1% 35%, 0% 30%, 2% 26%, 0% 22%,
    1% 18%, 0% 14%, 2% 10%, 0% 6%, 1% 3%, 0% 0%
  )`

function NavButton({
  onClick,
  active,
  solid,
  children,
  ...props
}: {
  onClick: () => void
  active?: boolean
  /** 实心反白：进行中的模式（路线）要与"面板开着"的浅色 active 一眼分开 */
  solid?: boolean
  children: React.ReactNode
  [key: string]: unknown
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: solid ? '#2a1f0e' : active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)',
        border: `1.5px solid ${solid ? '#2a1f0e' : active ? 'rgba(42,31,14,0.3)' : 'rgba(42,31,14,0.12)'}`,
        borderRadius: 8,
        // 44：WCAG 2.5.5 与 Apple HIG 的触摸目标下限。原先 40。
        // 放大它必须与窄屏折叠同批——六个 44 加间距是 304px，320 视口装不下。
        width: 44, height: 44,
        minWidth: 44, minHeight: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        color: solid ? '#fffdf7' : '#2a1f0e',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  )
}
