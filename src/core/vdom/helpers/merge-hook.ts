import VNode from '../vnode'
import { createFnInvoker } from './update-listeners'
import { remove, isDef, isUndef, isTrue } from 'shared/util'

export function mergeVNodeHook(
  def: Record<string, any>,
  hookKey: string,
  hook: Function
) {
  if (def instanceof VNode) {
    def = def.data!.hook || (def.data!.hook = {})
  }
  let invoker
  const oldHook = def[hookKey]

  function wrappedHook() {
    hook.apply(this, arguments)
    // 重要提示：删除合并的 hook 以确保它只被调用一次
    // 并防止内存泄漏
    remove(invoker.fns, wrappedHook)
  }

  if (isUndef(oldHook)) {
    // no existing hook
    invoker = createFnInvoker([wrappedHook])
  } else {
    /* istanbul ignore if */
    if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {
      // 已经是合并的祈求者
      invoker = oldHook
      invoker.fns.push(wrappedHook)
    } else {
      // 现有的普通钩
      invoker = createFnInvoker([oldHook, wrappedHook])
    }
  }

  invoker.merged = true
  def[hookKey] = invoker
}
