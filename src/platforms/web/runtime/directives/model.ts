/**
 * 不对此文件进行类型检查，因为 flow 不喜欢将属性附加到 Elements。
 */

import { isTextInputType } from 'web/util/element'
import { looseEqual, looseIndexOf } from 'shared/util'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import { warn, isIE9, isIE, isEdge } from 'core/util/index'

/* istanbul ignore if */
if (isIE9) {
  // http://www.matts411.com/post/internet-explorer-9-oninput/
  document.addEventListener('selectionchange', () => {
    const el = document.activeElement
    // @ts-expect-error
    if (el && el.vmodel) {
      trigger(el, 'input')
    }
  })
}

const directive = {
  inserted(el, binding, vnode, oldVnode) {
    if (vnode.tag === 'select') {
      // #6903
      if (oldVnode.elm && !oldVnode.elm._vOptions) {
        mergeVNodeHook(vnode, 'postpatch', () => {
          directive.componentUpdated(el, binding, vnode)
        })
      } else {
        setSelected(el, binding, vnode.context)
      }
      el._vOptions = [].map.call(el.options, getValue)
    } else if (vnode.tag === 'textarea' || isTextInputType(el.type)) {
      el._vModifiers = binding.modifiers
      if (!binding.modifiers.lazy) {
        el.addEventListener('compositionstart', onCompositionStart)
        el.addEventListener('compositionend', onCompositionEnd)
        // Safari < 10.2 & UIWebView在确认合成选择之前切换焦点时不触发合成结束，这也修复了某些浏览器，例如iOS：Chrome在自动完成时触发“更改”而不是“输入”的问题。
        el.addEventListener('change', onCompositionEnd)
        /* istanbul ignore if */
        if (isIE9) {
          el.vmodel = true
        }
      }
    }
  },

  componentUpdated(el, binding, vnode) {
    if (vnode.tag === 'select') {
      setSelected(el, binding, vnode.context)
      // 如果 v-for 渲染的选项发生了变化，
// 该值可能与渲染的选项不同步。
// 检测此类情况并筛选出不再具有匹配项的值
// 选项。
      const prevOptions = el._vOptions
      const curOptions = (el._vOptions = [].map.call(el.options, getValue))
      if (curOptions.some((o, i) => !looseEqual(o, prevOptions[i]))) {
        // 如果出现 Trigger Change Event，则触发更改事件
// 未找到至少一个值的匹配选项
        const needReset = el.multiple
          ? binding.value.some(v => hasNoMatchingOption(v, curOptions))
          : binding.value !== binding.oldValue &&
            hasNoMatchingOption(binding.value, curOptions)
        if (needReset) {
          trigger(el, 'change')
        }
      }
    }
  }
}

function setSelected(el, binding, vm) {
  actuallySetSelected(el, binding, vm)
  /* istanbul ignore if */
  if (isIE || isEdge) {
    setTimeout(() => {
      actuallySetSelected(el, binding, vm)
    }, 0)
  }
}

function actuallySetSelected(el, binding, vm) {
  const value = binding.value
  const isMultiple = el.multiple
  if (isMultiple && !Array.isArray(value)) {
    __DEV__ &&
      warn(
        `<select multiple v-model="${binding.expression}"> ` +
          `expects an Array value for its binding, but got ${Object.prototype.toString
            .call(value)
            .slice(8, -1)}`,
        vm
      )
    return
  }
  let selected, option
  for (let i = 0, l = el.options.length; i < l; i++) {
    option = el.options[i]
    if (isMultiple) {
      selected = looseIndexOf(value, getValue(option)) > -1
      if (option.selected !== selected) {
        option.selected = selected
      }
    } else {
      if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) {
          el.selectedIndex = i
        }
        return
      }
    }
  }
  if (!isMultiple) {
    el.selectedIndex = -1
  }
}

function hasNoMatchingOption(value, options) {
  return options.every(o => !looseEqual(o, value))
}

function getValue(option) {
  return '_value' in option ? option._value : option.value
}

function onCompositionStart(e) {
  e.target.composing = true
}

function onCompositionEnd(e) {
  // 无故阻止触发输入事件
  if (!e.target.composing) return
  e.target.composing = false
  trigger(e.target, 'input')
}

function trigger(el, type) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(type, true, true)
  el.dispatchEvent(e)
}

export default directive
