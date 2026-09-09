import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { EdgeLayerRoot } from '@/components/layout/EdgeLayer'

/**
 * 渲染 `NavigationUI` / `LabScene` 这类含屏角挂件的组件时必须用的 wrapper
 * （已包含 `LocaleProvider`）。
 *
 * 没有它 `EdgeItem` 返回 `null`，挂件根本不渲染，而报错只是「找不到元素」。
 * 不给 `EdgeItem` 做「缺容器就地渲染」的降级：那样忘了放 `EdgeLayerRoot` 的页面
 * 会静默退回各自定位、互相压住的样子，**而没有任何测试会红**。
 *
 * 只渲染单个非挂件组件的用例不要包——会多出九个空槽位容器，
 * `toBeEmptyDOMElement()` 必红。
 */
export function LabUiWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <EdgeLayerRoot>{children}</EdgeLayerRoot>
    </LocaleProvider>
  )
}
