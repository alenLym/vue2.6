import { _Set as Set, isObject, isArray } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'
import { isRef } from '../../v3'

const seenObjects = new Set()

/**
 * 递归遍历对象以调用所有已转换的 getter，以便对象中的每个嵌套属性都作为“深”依赖项收集。
 */

// 该函数traverse用于深度遍历给定值val，主要功能包括：

// 调用 _traverse 函数进行实际遍历处理。
// 清空 seenObjects 集合，可能用于清理遍历过程中记录的对象引用。
// 返回遍历后的val值。具体遍历逻辑由 _traverse 实现。
export function traverse(val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
  return val
}
// 该函数 _traverse 用于深度遍历一个值 val 并处理其依赖关系：

// 检查 val 是否为数组或对象，排除特定类型（如已冻结的对象、VNode 实例等）。
// 如果 val 有 __ob__ 属性，检查依赖是否已被遍历，避免重复处理。
// 根据 val 的类型（数组、引用或普通对象），递归遍历其元素或属性。
function _traverse(val: any, seen: SimpleSet) {
  let i, keys
  const isA = isArray(val)
  if (
    (!isA && !isObject(val)) ||
    val.__v_skip /* 响应式 flags.skip*/ ||
    Object.isFrozen(val) ||
    val instanceof VNode
  ) {
    return
  }
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else if (isRef(val)) {
    _traverse(val.value, seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
