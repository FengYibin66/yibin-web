'use client'

import { useMemo } from 'react'

import { content } from '@/lib/content'
import type { LabUiLabels } from '@/lib/content/types'

import { useLocale } from './useLocale'

/**
 * Lab 界面文案（审计 E7）。
 *
 * 存在的意义是**只有一个取文案的入口**：不然每个组件各写一遍
 * `content[locale].labUi`，而漏掉的那个就继续是硬编码英文——这正是 E7 的
 * 形态（只有房间内容接了 `useLocale`，界面壳子全没接）。
 *
 * `__tests__/labI18n.test.ts` 用 grep 守住：Lab 的组件里不能再出现界面用的
 * 英文字面量。
 */
export function useLabLabels(): LabUiLabels {
  const { locale } = useLocale()
  return useMemo(() => content[locale].labUi, [locale])
}
