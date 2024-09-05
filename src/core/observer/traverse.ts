import { _Set as Set, isObject, isArray } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'
import { isRef } from '../../v3'

const seenObjects = new Set()

/**
 * 递归遍历对象以调用所有已转换的 getter，以便对象中的每个嵌套属性都作为“深”依赖项收集。
 */
export function traverse(val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
  return val
}

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
