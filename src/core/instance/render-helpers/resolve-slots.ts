import type VNode from 'core/vdom/vnode'
import type { Component } from 'types/component'

/**
 * 用于将原始子 VNode 解析为 slot 对象的运行时帮助程序。
 */
export function resolveSlots(
  children: Array<VNode> | null | undefined,
  context: Component | null
): { [key: string]: Array<VNode> } {
  if (!children || !children.length) {
    return {}
  }
  const slots: Record<string, any> = {}
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    const data = child.data
    // 如果节点被解析为 Vue 插槽节点，则删除 slot 属性
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot
    }
    // 仅当 vnode 在
// 相同的上下文。
    if (
      (child.context === context || child.fnContext === context) &&
      data &&
      data.slot != null
    ) {
      const name = data.slot
      const slot = slots[name] || (slots[name] = [])
      if (child.tag === 'template') {
        slot.push.apply(slot, child.children || [])
      } else {
        slot.push(child)
      }
    } else {
      ;(slots.default || (slots.default = [])).push(child)
    }
  }
  // 忽略仅包含空格的插槽
  for (const name in slots) {
    if (slots[name].every(isWhitespace)) {
      delete slots[name]
    }
  }
  return slots
}

function isWhitespace(node: VNode): boolean {
  return (node.isComment && !node.asyncFactory) || node.text === ' '
}
