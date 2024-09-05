import type { ScopedSlotsData } from 'types/vnode'
import { isArray } from 'core/util'

export function resolveScopedSlots(
  fns: ScopedSlotsData,
  res?: Record<string, any>,
  // 在 2.6 中添加了以下内容
  hasDynamicKeys?: boolean,
  contentHashKey?: number
): { $stable: boolean } & { [key: string]: Function } {
  res = res || { $stable: !hasDynamicKeys }
  for (let i = 0; i < fns.length; i++) {
    const slot = fns[i]
    if (isArray(slot)) {
      resolveScopedSlots(slot, res, hasDynamicKeys)
    } else if (slot) {
      // 用于反向代理 v-slot 的 marker 而不在 this 上$slots
      // @ts期望错误
      if (slot.proxy) {
        // @ts-expect-error
        slot.fn.proxy = true
      }
      res[slot.key] = slot.fn
    }
  }
  if (contentHashKey) {
    ; (res as any).$key = contentHashKey
  }
  return res as any
}
