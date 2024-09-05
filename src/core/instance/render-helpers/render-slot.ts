import { extend, warn, isObject, isFunction } from 'core/util/index'
import VNode from 'core/vdom/vnode'

/**
 * 用于渲染<slot>的运行时帮助程序
 */
export function renderSlot(
  name: string,
  fallbackRender: ((() => Array<VNode>) | Array<VNode>) | null,
  props: Record<string, any> | null,
  bindObject: object | null
): Array<VNode> | null {
  const scopedSlotFn = this.$scopedSlots[name]
  let nodes
  if (scopedSlotFn) {
    // scoped slot
    props = props || {}
    if (bindObject) {
      if (__DEV__ && !isObject(bindObject)) {
        warn('slot v-bind without argument expects an Object', this)
      }
      props = extend(extend({}, bindObject), props)
    }
    nodes =
      scopedSlotFn(props) ||
      (isFunction(fallbackRender) ? fallbackRender() : fallbackRender)
  } else {
    nodes =
      this.$slots[name] ||
      (isFunction(fallbackRender) ? fallbackRender() : fallbackRender)
  }

  const target = props && props.slot
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}
