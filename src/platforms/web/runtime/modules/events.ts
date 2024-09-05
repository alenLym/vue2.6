import { isDef, isUndef } from 'shared/util'
import { updateListeners } from 'core/vdom/helpers/index'
import { isIE, isFF, supportsPassive, isUsingMicroTask } from 'core/util/index'
import {
  RANGE_TOKEN,
  CHECKBOX_RADIO_TOKEN
} from 'web/compiler/directives/model'
import { currentFlushTimestamp } from 'core/observer/scheduler'
import { emptyNode } from 'core/vdom/patch'
import type { VNodeWithData } from 'types/vnode'

// 规范化只能在运行时确定的 V-Model 事件标记。
// 将事件放在数组中的第一个很重要，因为
// 关键是确保 v-model 回调在之前被调用
// 用户附加的处理程序。
function normalizeEvents(on) {
  /* istanbul ignore if */
  if (isDef(on[RANGE_TOKEN])) {
    // IE input[type=range] only supports `change` event
    const event = isIE ? 'change' : 'input'
    on[event] = [].concat(on[RANGE_TOKEN], on[event] || [])
    delete on[RANGE_TOKEN]
  }
  // 这最初是为了修复 #4521，但在 2.5 之后不再需要。保持它与 < 2.4 生成的代码向后兼容
  /* istanbul ignore if */
  if (isDef(on[CHECKBOX_RADIO_TOKEN])) {
    on.change = [].concat(on[CHECKBOX_RADIO_TOKEN], on.change || [])
    delete on[CHECKBOX_RADIO_TOKEN]
  }
}

let target: any

function createOnceHandler(event, handler, capture) {
  const _target = target // 将当前目标元素保存在闭包中
  return function onceHandler() {
    const res = handler.apply(null, arguments)
    if (res !== null) {
      remove(event, onceHandler, capture, _target)
    }
  }
}

// #9446： Firefox <= 53（特别是 ESR 52）的 Event.timeStamp 不正确
// 实现，并且不会在事件传播之间触发微任务，因此
// 可以安全排除。
const useMicrotaskFix = isUsingMicroTask && !(isFF && Number(isFF[1]) <= 53)

function add(
  name: string,
  handler: Function,
  capture: boolean,
  passive: boolean
) {
  // 异步边缘案例 #6566： 内部点击事件触发补丁、事件处理程序
// 在 patch 期间附加到 outer element，并再次触发。这
// 发生这种情况是因为浏览器在事件传播之间触发了微任务 tick。
// 解决方案很简单：我们在附加处理程序时保存时间戳，
// 并且处理程序仅在传递给它的事件被触发时触发
// 在它被附上之后。
  if (useMicrotaskFix) {
    const attachedTimestamp = currentFlushTimestamp
    const original = handler
    //@ts-expect-error
    handler = original._wrapper = function (e) {
      if (
        // 没有冒泡，应该总是触发。
// 这只是一个安全网，以防 event.timeStamp 在
// 某些奇怪的环境......
        e.target === e.currentTarget ||
        // 事件在处理程序附件后触发
        e.timeStamp >= attachedTimestamp ||
        // bail 用于具有 bug event.timeStamp 实现的环境
// #9462 iOS 9 错误：history.pushState 后 event.timeStamp 为 0
// #9681 QtWebEngine event.timeStamp 为负值
        e.timeStamp <= 0 ||
        // #9448 如果在多页的另一个文档中触发事件，则保释
// electron/nw.js 应用程序，因为 event.timeStamp 将使用不同的
// 起始参考
        e.target.ownerDocument !== document
      ) {
        return original.apply(this, arguments)
      }
    }
  }
  target.addEventListener(
    name,
    handler,
    supportsPassive ? { capture, passive } : capture
  )
}

function remove(
  name: string,
  handler: Function,
  capture: boolean,
  _target?: HTMLElement
) {
  ;(_target || target).removeEventListener(
    name,
    //@ts-expect-error
    handler._wrapper || handler,
    capture
  )
}

function updateDOMListeners(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
    return
  }
  const on = vnode.data.on || {}
  const oldOn = oldVnode.data.on || {}
  // vnode 在删除所有侦听器时为空，
// 并使用旧的 vnode DOM 元素
  target = vnode.elm || oldVnode.elm
  normalizeEvents(on)
  updateListeners(on, oldOn, add, remove, createOnceHandler, vnode.context)
  target = undefined
}

export default {
  create: updateDOMListeners,
  update: updateDOMListeners,
  // @ts-expect-error emptyNode 实际上有数据
  destroy: (vnode: VNodeWithData) => updateDOMListeners(vnode, emptyNode)
}
