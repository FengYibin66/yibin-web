import type { HeroContent, Locale } from './types'

/**
 * 名字按语言分主次。
 *
 * `hero.name`（英文名）与 `hero.nameZh`（中文名）在两份 locale 里内容相同——名字
 * 本身不翻译，翻译的是**哪个当主标题**：zh 主中文副英文，en 主英文副中文。
 *
 * 抽成纯函数是因为两个使用方（门户的 Classic 面板、Classic 首屏）此前各自硬编码
 * 「英文大、中文小」，切到中文后眉题、标签、按钮全是中文，唯独名字还是英文
 * （2026-09-07 实机反馈）。规则只写一份，改一处两边同步。
 *
 * Lab 的 About 房间（`AboutRoom` 的 3D 标题）不走这里：它用的是拉丁手写显示字体
 * （`CabinSketch`），没有汉字字形，换成中文名要先解决字体。
 */
export function heroNames(
  hero: Pick<HeroContent, 'name' | 'nameZh'>,
  locale: Locale,
): { primary: string; secondary: string } {
  return locale === 'zh'
    ? { primary: hero.nameZh, secondary: hero.name }
    : { primary: hero.name, secondary: hero.nameZh }
}
