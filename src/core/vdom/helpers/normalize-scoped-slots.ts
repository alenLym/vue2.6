import { def } from 'core/util/lang'
import { normalizeChildren } from 'core/vdom/helpers/normalize-children'
import { emptyObject, isArray } from 'shared/util'
import { isAsyncPlaceholder } from './is-async-placeholder'
import type VNode from '../vnode'
import { Component } from 'types/component'
import { currentInstance, setCurrentInstance } from 'v3/currentInstance'

export function normalizeScopedSlots(
  ownerVm: Component,
  scopedSlots: { [key: string]: Function } | undefined,
  normalSlots: { [key: string]: VNode[] },
  prevScopedSlots?: { [key: string]: Function }
): any {
  let res
  const hasNormalSlots = Object.keys(normalSlots).length > 0
  const isStable = scopedSlots ? !!scopedSlots.$stable : !hasNormalSlots
  const key = scopedSlots && scopedSlots.$key
  if (!scopedSlots) {
    res = {}
  } else if (scopedSlots._normalized) {
    // 快速路径 1：仅重新渲染子组件，父组件未更改
    return scopedSlots._normalized
  } else if (
    isStable &&
    prevScopedSlots &&
    prevScopedSlots !== emptyObject &&
    key === prevScopedSlots.$key &&
    !hasNormalSlots &&
    !prevScopedSlots.$hasNormal
  ) {
    // Fast Path 2：稳定的 Scoped 插槽，没有普通的插槽到代理，
// 只需要规范化一次
    return prevScopedSlots
  } else {
    res = {}
    for (const key in scopedSlots) {
      if (scopedSlots[key] && key[0] !== '$') {
        res[key] = normalizeScopedSlot(
          ownerVm,
          normalSlots,
          key,
          scopedSlots[key]
        )
      }
    }
  }
  // 在 scopedSlots 上公开普通插槽
  for (const key in normalSlots) {
    if (!(key in res)) {
      res[key] = proxyNormalSlot(normalSlots, key)
    }
  }
  // Avoriaz 似乎模拟了一个不可扩展的 $scopedSlots 对象
// 当它被传递时，这将导致错误
  if (scopedSlots && Object.isExtensible(scopedSlots)) {
    scopedSlots._normalized = res
  }
  def(res, '$stable', isStable)
  def(res, '$key', key)
  def(res, '$hasNormal', hasNormalSlots)
  return res
}

function normalizeScopedSlot(vm, normalSlots, key, fn) {
  const normalized = function () {
    const cur = currentInstance
    setCurrentInstance(vm)
    let res = arguments.length ? fn.apply(null, arguments) : fn({})
    res =
      res && typeof res === 'object' && !isArray(res)
        ? [res] // 单个 vnode
        : normalizeChildren(res)
    const vnode: VNode | null = res && res[0]
    setCurrentInstance(cur)
    return res &&
      (!vnode ||
        (res.length === 1 && vnode.isComment && !isAsyncPlaceholder(vnode))) // #9658, #10391
      ? undefined
      : res
  }
  // 这是一个使用新的 v-slot 语法的 slot ，没有 scope。虽然它是
// 编译为范围插槽，则 render fn 用户会期望它存在
// 在 this.$slots 上，因为该用法在语义上是一个普通的 slot。
  if (fn.proxy) {
    Object.defineProperty(normalSlots, key, {
      get: normalized,
      enumerable: true,
      configurable: true
    })
  }
  return normalized
}

function proxyNormalSlot(slots, key) {
  return () => slots[key]
}
