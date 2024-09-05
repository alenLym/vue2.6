import { isDef, isUndef, extend, toNumber, isTrue } from 'shared/util'
import type { VNodeWithData } from 'types/vnode'
import { isSVG } from 'web/util/index'

let svgContainer

function updateDOMProps(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (isUndef(oldVnode.data.domProps) && isUndef(vnode.data.domProps)) {
    return
  }
  let key, cur
  const elm: any = vnode.elm
  const oldProps = oldVnode.data.domProps || {}
  let props = vnode.data.domProps || {}
  // 克隆观察到的对象，因为用户可能想要改变它
  if (isDef(props.__ob__) || isTrue(props._v_attr_proxy)) {
    props = vnode.data.domProps = extend({}, props)
  }

  for (key in oldProps) {
    if (!(key in props)) {
      elm[key] = ''
    }
  }

  for (key in props) {
    cur = props[key]
    // 如果节点具有 textContent 或 innerHTML，则忽略 children，
// 因为它们会丢弃现有的 DOM 节点并导致删除错误
// 在后续补丁中 （#3360）
    if (key === 'textContent' || key === 'innerHTML') {
      if (vnode.children) vnode.children.length = 0
      if (cur === oldProps[key]) continue
      // #6601 解决 Chrome 版本 <= 55 单个 textNode 的 bug
// 替换为 innerHTML/textContent 保留其 parentNode 属性
      if (elm.childNodes.length === 1) {
        elm.removeChild(elm.childNodes[0])
      }
    }

    if (key === 'value' && elm.tagName !== 'PROGRESS') {
      // 存储值也_value因为
// 非字符串值将被字符串化
      elm._value = cur
      // 避免在 Value 相同时重置光标位置
      const strCur = isUndef(cur) ? '' : String(cur)
      if (shouldUpdateValue(elm, strCur)) {
        elm.value = strCur
      }
    } else if (
      key === 'innerHTML' &&
      isSVG(elm.tagName) &&
      isUndef(elm.innerHTML)
    ) {
      // IE 不支持 SVG 元素的 innerHTML
      svgContainer = svgContainer || document.createElement('div')
      svgContainer.innerHTML = `<svg>${cur}</svg>`
      const svg = svgContainer.firstChild
      while (elm.firstChild) {
        elm.removeChild(elm.firstChild)
      }
      while (svg.firstChild) {
        elm.appendChild(svg.firstChild)
      }
    } else if (
      // 如果新旧 VDOM 状态相同，则跳过更新。
// 'value' 是单独处理的，因为 DOM 值可能是临时的
// 由于焦点、合成和修饰符的原因，与 VDOM 状态不同步。
// 此 #4521 通过跳过不必要的“checked”更新。
      cur !== oldProps[key]
    ) {
      // 某些属性更新可能会引发
// 例如，<progress>w/ 非有限值上的 'value'
      try {
        elm[key] = cur
      } catch (e: any) {}
    }
  }
}

// check platforms/web/util/attrs.js acceptValue
type acceptValueElm = HTMLInputElement | HTMLSelectElement | HTMLOptionElement

function shouldUpdateValue(elm: acceptValueElm, checkVal: string): boolean {
  return (
    //@ts-expect-error
    !elm.composing &&
    (elm.tagName === 'OPTION' ||
      isNotInFocusAndDirty(elm, checkVal) ||
      isDirtyWithModifiers(elm, checkVal))
  )
}

function isNotInFocusAndDirty(elm: acceptValueElm, checkVal: string): boolean {
  // 当 TextBox（.number 和 .trim）失去焦点且其值为
// 不等于更新的值
  let notInFocus = true
  // #6157
// 解决在 iframe 中访问 document.activeElement 时的 IE 错误
  try {
    notInFocus = document.activeElement !== elm
  } catch (e: any) {}
  return notInFocus && elm.value !== checkVal
}

function isDirtyWithModifiers(elm: any, newVal: string): boolean {
  const value = elm.value
  const modifiers = elm._vModifiers // 由 V-Model 运行时注入
  if (isDef(modifiers)) {
    if (modifiers.number) {
      return toNumber(value) !== toNumber(newVal)
    }
    if (modifiers.trim) {
      return value.trim() !== newVal.trim()
    }
  }
  return value !== newVal
}

export default {
  create: updateDOMProps,
  update: updateDOMProps
}
