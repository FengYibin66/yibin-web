import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { EdgeLayerRoot } from '@/components/layout/EdgeLayer'

/**
 * 渲染 `NavigationUI` / `LabScene` 这类含屏角挂件的组件时必须用的 wrapper。
 *
 * ## 为什么会需要它
 *
 * `EdgeItem` 是 portal，目标容器由 `EdgeLayerRoot` 提供。**没有它时 `EdgeItem`
 * 返回 `null`**——于是「退出 Lab」「导航图标排」「房间内返回」在测试里根本不渲染，
 * 而报错是 `getByTestId('nav-back')` 找不到元素，看不出真实原因。
 * 收编 Lab 顶栏那次，三个测试文件共 12 条一起红就是这个。
 *
 * ## 为什么不让 `EdgeItem` 在缺容器时「就地渲染」降级
 *
 * 那样忘了放 `EdgeLayerRoot` 的页面会静默退回到收编前的样子——每个挂件各自
 * 定位、互相压住，**而没有任何测试会红**。这正是这次改动要消灭的形态。
 * 宁可测试里多包一层：形态照 `LocaleProvider` 的 `throwingDefault`
 * （见 `apps/resume/AGENTS.md`「测试环境的两个坑」），代价一样、理由一样。
 */
export function LabUiWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <EdgeLayerRoot>{children}</EdgeLayerRoot>
    </LocaleProvider>
  )
}
