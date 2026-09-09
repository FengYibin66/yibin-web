'use client'

import type { EducationEntry } from '@/lib/content/types'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { ClassicBackLink } from './ClassicBackLink'

export function EducationDetailView({ edu }: { edu: EducationEntry }) {
  const { locale } = useLocale()
  const labels = content[locale].education

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <ClassicBackLink href="/classic/#education" />

      {/*
        ## 这个头部为什么长这样（2026-09-09 重写）

        原先是 `flex flex-wrap items-start gap-4`，三个子项：`h-12 w-auto` 的 logo、
        `flex-1 min-w-0` 的文字列、不收缩的 QS 卡。结果在手机上塌成这样（实测 390px）：

            h1 盒 31×180，文字一词一行，连 `·` 分隔符都单独占一行
            日期那行约 14 行
            h1 的字形溢出自身盒 137px，画到 QS 卡上（h1 是 overflow: visible，
            所以两个盒子并不相交 —— 只做矩形相交的检查抓不到这一条）

        根因两条，缺一不可：

        1. **logo 按高度限制**。`h-12 w-auto` 下宽度由比例决定，而 `NUS SOC.png` 是
           532×95 = 5.6:1 → 48px 高时宽 **269px**。320px 视口内容宽 272，它一个人吃光。
           视口越宽 logo 越宽、文字列越窄 —— 这就是「390px 比 320px 更糟」的原因。
        2. **`flex-wrap` 与 `min-w-0` 语义互斥**。`min-w-0` 把该列的 min-content 贡献
           抹成 0，于是 flex 容器永远认为「一行放得下」，`flex-wrap` **永不触发**，
           宁可把文字压到 31px 也不换行。

        ## 修法

        - **文字块不再与任何刚性兄弟同处一个 flex 行**。窄屏是「logo + QS」一行、
          文字整宽一块；宽屏才用 grid 三栏。这样在结构上就不可能被挤 —— 不依赖
          任何断点取值是否恰当。
        - **logo 同时给 `max-h` 与 `max-w`**，哪个先到算哪个：横版（5.6:1）由宽度
          兜住 → 150×27；方版（1:1）由高度兜住 → 32×32。这样不需要在内容数据里
          声明比例（那会是另一个决策），CSS 自己就能分流。
        - grid 中栏写 `minmax(0,1fr)` 而不是 `1fr`：后者的 min 是 `auto`，长单词会
          撑破网格；前者才是「可缩到 0」，而两侧栏宽度确定，不会像 flex 那样被吃掉。
        - **`degree` 从 h1 里拿出来做 eyebrow**。「MSc · Computer Science」里的 `·`
          是个可断行的普通字符，正是它单独占一行的原因；而 degree 本就是分类不是标题。
        - logo 加一块底板：`imperial horizontal.png` 无 tRNS 透明块、棋盘格烤进了像素
          （见 public/education 的资产问题），有底板时它读作「logo 有个底」而不是
          「页面破了个洞」；深色主题下深墨稿校徽也需要浅底才看得见。
      */}
      <div className="mb-8 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:gap-5">
        {/* 窄屏：logo 与 QS 同一行两端对齐；宽屏：各自占 grid 的第一、三栏 */}
        <div className="mb-4 flex items-center justify-between gap-3 sm:contents">
          {edu.logo ? (
            <img
              src={edu.logo}
              alt={edu.school}
              className="h-auto w-auto max-h-8 max-w-[150px] shrink-0 object-contain opacity-90 sm:max-h-9 sm:max-w-[200px]"
            />
          ) : (
            <span className="sm:hidden" />
          )}
          {edu.qsRank ? (
            <div
              className="shrink-0 rounded-lg px-2.5 py-1 text-center sm:order-last sm:rounded-xl sm:px-4 sm:py-3"
              style={{
                background: 'linear-gradient(160deg, #00d4ff22, #6366f122)',
                border: '1px solid #00d4ff44',
              }}
            >
              <div
                className="text-[11px] uppercase tracking-wider sm:mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {edu.qsLabel ?? 'QS'}
              </div>
              <div
                className="font-display text-xl font-bold leading-none sm:text-3xl"
                style={{ color: 'var(--accent-primary)' }}
              >
                {edu.qsRank}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <div
            className="text-[11px] font-medium uppercase tracking-[0.18em]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {edu.degree}
          </div>
          <h1
            className="font-display text-2xl font-bold leading-tight sm:text-3xl"
            style={{ color: 'var(--text-primary)', textWrap: 'balance' }}
          >
            {edu.field}
          </h1>
          <p className="mt-1.5" style={{ color: 'var(--accent-primary)' }}>
            {edu.school}
          </p>
          {/*
            分隔符用**不换行空格 + `·`** 粘在前一段末尾（` ·`），后面跟一个普通
            空格。这样 `·` 不可能落到行首，而长段落仍然正常换行。

            我第一版给每段包了 `whitespace-nowrap`，结果第三段
            「Merit; Distinction in Final Design & Research Project」完全不能换行，
            整行冲出右边缘被裁掉——**比原来的毛病更严重**。
            而且当时 `documentElement.scrollWidth - innerWidth` 量出来是 0，
            只有整页截图（宽 557 CSS px > 390）才暴露它：这类溢出得逐元素查右边界，
            文档级的 scrollWidth 不可靠。
          */}
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {[edu.period, edu.location, edu.note].filter(Boolean).map((part, i, all) => (
              <span key={part as string}>
                {part}
                {i < all.length - 1 ? (
                  <span aria-hidden className="opacity-55">
                    {' · '}
                  </span>
                ) : null}
              </span>
            ))}
          </p>
        </div>
      </div>

      {edu.keyModules && edu.keyModules.length > 0 ? (
        <section>
          <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {labels.keyModulesLabel}
          </h2>
          <div className="flex flex-wrap gap-2">
            {edu.keyModules.map((mod) => (
              <span
                key={mod}
                className="text-sm px-3 py-1.5 rounded-full border"
                style={{
                  color: 'var(--text-primary)',
                  borderColor: 'var(--bg-border)',
                  background: 'var(--bg-surface)',
                }}
              >
                {mod}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
