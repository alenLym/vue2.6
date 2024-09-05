import VNode from 'core/vdom/vnode'
import { cached, extend, toObject } from 'shared/util'
import type { VNodeData, VNodeWithData } from 'types/vnode'

export const parseStyleText = cached(function (cssText) {
  const res = {}
  const listDelimiter = /;(?![^(]*\))/g
  const propertyDelimiter = /:(.+)/
  cssText.split(listDelimiter).forEach(function (item) {
    if (item) {
      const tmp = item.split(propertyDelimiter)
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim())
    }
  })
  return res
})

// 在同一个 vnode 上合并静态和动态样式数据
function normalizeStyleData(data: VNodeData): Record<string, any> {
  const style = normalizeStyleBinding(data.style)
  // static 样式在编译时被预处理成一个对象
// 并且始终是一个新鲜对象，因此可以安全地合并到其中
  return data.staticStyle ? extend(data.staticStyle, style) : style
}

// normalize possible array / string values into Object
export function normalizeStyleBinding(bindingStyle: any): Record<string, any> {
  if (Array.isArray(bindingStyle)) {
    return toObject(bindingStyle)
  }
  if (typeof bindingStyle === 'string') {
    return parseStyleText(bindingStyle)
  }
  return bindingStyle
}

/**
 * 父组件样式应位于 Child 的
 * ，以便父组件的样式可以覆盖它
 */
export function getStyle(vnode: VNodeWithData, checkChild: boolean): Object {
  const res = {}
  let styleData

  if (checkChild) {
    let childNode: VNodeWithData | VNode = vnode
    while (childNode.componentInstance) {
      childNode = childNode.componentInstance._vnode!
      if (
        childNode &&
        childNode.data &&
        (styleData = normalizeStyleData(childNode.data))
      ) {
        extend(res, styleData)
      }
    }
  }

  if ((styleData = normalizeStyleData(vnode.data))) {
    extend(res, styleData)
  }

  let parentNode: VNodeWithData | VNode | undefined = vnode
  // @ts-expect-error parentNode.parent 不是 VNodeWithData
  while ((parentNode = parentNode.parent)) {
    if (parentNode.data && (styleData = normalizeStyleData(parentNode.data))) {
      extend(res, styleData)
    }
  }
  return res
}
