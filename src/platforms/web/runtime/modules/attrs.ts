import { isIE, isIE9, isEdge } from 'core/util/env'

import { extend, isDef, isUndef, isTrue } from 'shared/util'
import type { VNodeWithData } from 'types/vnode'

import {
  isXlink,
  xlinkNS,
  getXlinkProp,
  isBooleanAttr,
  isEnumeratedAttr,
  isFalsyAttrValue,
  convertEnumeratedValue
} from 'web/util/index'

function updateAttrs(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  const opts = vnode.componentOptions
  if (isDef(opts) && opts.Ctor.options.inheritAttrs === false) {
    return
  }
  if (isUndef(oldVnode.data.attrs) && isUndef(vnode.data.attrs)) {
    return
  }
  let key, cur, old
  const elm = vnode.elm
  const oldAttrs = oldVnode.data.attrs || {}
  let attrs: any = vnode.data.attrs || {}
  // 克隆观察到的对象，因为用户可能想要改变它
  if (isDef(attrs.__ob__) || isTrue(attrs._v_attr_proxy)) {
    attrs = vnode.data.attrs = extend({}, attrs)
  }

  for (key in attrs) {
    cur = attrs[key]
    old = oldAttrs[key]
    if (old !== cur) {
      setAttr(elm, key, cur, vnode.data.pre)
    }
  }
  // #4391： 在 IE9 中，设置类型可以重置 input[type=radio] 的值
// #6666： IE/Edge 在设置最大值之前强制进度值降低到 1
  /* istanbul ignore if */
  if ((isIE || isEdge) && attrs.value !== oldAttrs.value) {
    setAttr(elm, 'value', attrs.value)
  }
  for (key in oldAttrs) {
    if (isUndef(attrs[key])) {
      if (isXlink(key)) {
        elm.removeAttributeNS(xlinkNS, getXlinkProp(key))
      } else if (!isEnumeratedAttr(key)) {
        elm.removeAttribute(key)
      }
    }
  }
}

function setAttr(el: Element, key: string, value: any, isInPre?: any) {
  if (isInPre || el.tagName.indexOf('-') > -1) {
    baseSetAttr(el, key, value)
  } else if (isBooleanAttr(key)) {
    // 为空白值设置属性
// 例如<option disabled>选择一个</option>
    if (isFalsyAttrValue(value)) {
      el.removeAttribute(key)
    } else {
      // 从技术上讲，allowFullScreen 是 的布尔属性 <iframe>，
// 但 Flash 在用于标记时需要值 “true”<embed>
      value = key === 'allowfullscreen' && el.tagName === 'EMBED' ? 'true' : key
      el.setAttribute(key, value)
    }
  } else if (isEnumeratedAttr(key)) {
    el.setAttribute(key, convertEnumeratedValue(key, value))
  } else if (isXlink(key)) {
    if (isFalsyAttrValue(value)) {
      el.removeAttributeNS(xlinkNS, getXlinkProp(key))
    } else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  } else {
    baseSetAttr(el, key, value)
  }
}

function baseSetAttr(el, key, value) {
  if (isFalsyAttrValue(value)) {
    el.removeAttribute(key)
  } else {
    // #7138： IE10 & 11 在将 placeholder 设置为 ON 时触发输入事件
// <textarea>...阻止第一个 input 事件并删除阻止程序
// 马上。
    /* istanbul ignore if */
    if (
      isIE &&
      !isIE9 &&
      el.tagName === 'TEXTAREA' &&
      key === 'placeholder' &&
      value !== '' &&
      !el.__ieph
    ) {
      const blocker = e => {
        e.stopImmediatePropagation()
        el.removeEventListener('input', blocker)
      }
      el.addEventListener('input', blocker)
      // $flow-disable-line
      el.__ieph = true /* IE 占位符已修补*/
    }
    el.setAttribute(key, value)
  }
}

export default {
  create: updateAttrs,
  update: updateAttrs
}
