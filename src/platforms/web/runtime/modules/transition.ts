import { inBrowser, isIE9, warn } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import { activeInstance } from 'core/instance/lifecycle'

import {
  once,
  isDef,
  isUndef,
  isObject,
  toNumber,
  isFunction
} from 'shared/util'

import {
  nextFrame,
  resolveTransition,
  whenTransitionEnds,
  addTransitionClass,
  removeTransitionClass
} from 'web/runtime/transition-util'

import type { VNodeWithData } from 'types/vnode'
import VNode from 'core/vdom/vnode'

export function enter(vnode: VNodeWithData, toggleDisplay?: () => void) {
  const el: any = vnode.elm

  // 立即呼叫 leave callback
  if (isDef(el._leaveCb)) {
    el._leaveCb.cancelled = true
    el._leaveCb()
  }

  const data = resolveTransition(vnode.data.transition)
  if (isUndef(data)) {
    return
  }

  /* istanbul ignore if */
  if (isDef(el._enterCb) || el.nodeType !== 1) {
    return
  }

  const {
    css,
    type,
    enterClass,
    enterToClass,
    enterActiveClass,
    appearClass,
    appearToClass,
    appearActiveClass,
    beforeEnter,
    enter,
    afterEnter,
    enterCancelled,
    beforeAppear,
    appear,
    afterAppear,
    appearCancelled,
    duration
  } = data

  // activeInstance 将始终是<transition>管理此
// 过渡。需要检查的一个极端情况是<transition>当
// 作为子组件的根节点。在这种情况下，我们需要检查
// <transition>的父项进行显示检查。
  let context = activeInstance
  let transitionNode = activeInstance.$vnode
  while (transitionNode && transitionNode.parent) {
    context = transitionNode.context
    transitionNode = transitionNode.parent
  }

  const isAppear = !context._isMounted || !vnode.isRootInsert

  if (isAppear && !appear && appear !== '') {
    return
  }

  const startClass = isAppear && appearClass ? appearClass : enterClass
  const activeClass =
    isAppear && appearActiveClass ? appearActiveClass : enterActiveClass
  const toClass = isAppear && appearToClass ? appearToClass : enterToClass

  const beforeEnterHook = isAppear ? beforeAppear || beforeEnter : beforeEnter
  const enterHook = isAppear ? (isFunction(appear) ? appear : enter) : enter
  const afterEnterHook = isAppear ? afterAppear || afterEnter : afterEnter
  const enterCancelledHook = isAppear
    ? appearCancelled || enterCancelled
    : enterCancelled

  const explicitEnterDuration: any = toNumber(
    isObject(duration) ? duration.enter : duration
  )

  if (__DEV__ && explicitEnterDuration != null) {
    checkDuration(explicitEnterDuration, 'enter', vnode)
  }

  const expectsCSS = css !== false && !isIE9
  const userWantsControl = getHookArgumentsLength(enterHook)

  const cb = (el._enterCb = once(() => {
    if (expectsCSS) {
      removeTransitionClass(el, toClass)
      removeTransitionClass(el, activeClass)
    }
    // @ts-expect-error
    if (cb.cancelled) {
      if (expectsCSS) {
        removeTransitionClass(el, startClass)
      }
      enterCancelledHook && enterCancelledHook(el)
    } else {
      afterEnterHook && afterEnterHook(el)
    }
    el._enterCb = null
  }))

  if (!vnode.data.show) {
    // 通过注入 Insert 钩子在 enter 时删除 pending leave 元素
    mergeVNodeHook(vnode, 'insert', () => {
      const parent = el.parentNode
      const pendingNode =
        parent && parent._pending && parent._pending[vnode.key!]
      if (
        pendingNode &&
        pendingNode.tag === vnode.tag &&
        pendingNode.elm._leaveCb
      ) {
        pendingNode.elm._leaveCb()
      }
      enterHook && enterHook(el, cb)
    })
  }

  // 开始 进入过渡
  beforeEnterHook && beforeEnterHook(el)
  if (expectsCSS) {
    addTransitionClass(el, startClass)
    addTransitionClass(el, activeClass)
    nextFrame(() => {
      removeTransitionClass(el, startClass)
      // @ts-expect-error
      if (!cb.cancelled) {
        addTransitionClass(el, toClass)
        if (!userWantsControl) {
          if (isValidDuration(explicitEnterDuration)) {
            setTimeout(cb, explicitEnterDuration)
          } else {
            whenTransitionEnds(el, type, cb)
          }
        }
      }
    })
  }

  if (vnode.data.show) {
    toggleDisplay && toggleDisplay()
    enterHook && enterHook(el, cb)
  }

  if (!expectsCSS && !userWantsControl) {
    cb()
  }
}

export function leave(vnode: VNodeWithData, rm: Function) {
  const el: any = vnode.elm

  // 立即调用 enter callback
  if (isDef(el._enterCb)) {
    el._enterCb.cancelled = true
    el._enterCb()
  }

  const data = resolveTransition(vnode.data.transition)
  if (isUndef(data) || el.nodeType !== 1) {
    return rm()
  }

  /* istanbul ignore if */
  if (isDef(el._leaveCb)) {
    return
  }

  const {
    css,
    type,
    leaveClass,
    leaveToClass,
    leaveActiveClass,
    beforeLeave,
    leave,
    afterLeave,
    leaveCancelled,
    delayLeave,
    duration
  } = data

  const expectsCSS = css !== false && !isIE9
  const userWantsControl = getHookArgumentsLength(leave)

  const explicitLeaveDuration: any = toNumber(
    isObject(duration) ? duration.leave : duration
  )

  if (__DEV__ && isDef(explicitLeaveDuration)) {
    checkDuration(explicitLeaveDuration, 'leave', vnode)
  }

  const cb = (el._leaveCb = once(() => {
    if (el.parentNode && el.parentNode._pending) {
      el.parentNode._pending[vnode.key!] = null
    }
    if (expectsCSS) {
      removeTransitionClass(el, leaveToClass)
      removeTransitionClass(el, leaveActiveClass)
    }
    // @ts-expect-error
    if (cb.cancelled) {
      if (expectsCSS) {
        removeTransitionClass(el, leaveClass)
      }
      leaveCancelled && leaveCancelled(el)
    } else {
      rm()
      afterLeave && afterLeave(el)
    }
    el._leaveCb = null
  }))

  if (delayLeave) {
    delayLeave(performLeave)
  } else {
    performLeave()
  }

  function performLeave() {
    // 延迟休假可能已被取消
// @ts期望错误
    if (cb.cancelled) {
      return
    }
    // 记录离开元素
    if (!vnode.data.show && el.parentNode) {
      ;(el.parentNode._pending || (el.parentNode._pending = {}))[vnode.key!] =
        vnode
    }
    beforeLeave && beforeLeave(el)
    if (expectsCSS) {
      addTransitionClass(el, leaveClass)
      addTransitionClass(el, leaveActiveClass)
      nextFrame(() => {
        removeTransitionClass(el, leaveClass)
        // @ts-expect-error
        if (!cb.cancelled) {
          addTransitionClass(el, leaveToClass)
          if (!userWantsControl) {
            if (isValidDuration(explicitLeaveDuration)) {
              setTimeout(cb, explicitLeaveDuration)
            } else {
              whenTransitionEnds(el, type, cb)
            }
          }
        }
      })
    }
    leave && leave(el, cb)
    if (!expectsCSS && !userWantsControl) {
      cb()
    }
  }
}

// 仅在开发模式下使用
function checkDuration(val, name, vnode) {
  if (typeof val !== 'number') {
    warn(
      `<transition> explicit ${name} duration is not a valid number - ` +
        `got ${JSON.stringify(val)}.`,
      vnode.context
    )
  } else if (isNaN(val)) {
    warn(
      `<transition> explicit ${name} duration is NaN - ` +
        'the duration expression might be incorrect.',
      vnode.context
    )
  }
}

function isValidDuration(val) {
  return typeof val === 'number' && !isNaN(val)
}

/**
 * 规范化 transition hook 的参数长度。钩子可以是：
 * - 与 .fns 中的原始钩子合并的钩子 （invoker）
 * - 包装组件方法（检查 ._length）
 * - 一个普通函数 （.length）
 */
function getHookArgumentsLength(fn: Function): boolean {
  if (isUndef(fn)) {
    return false
  }
  // @ts-expect-error
  const invokerFns = fn.fns
  if (isDef(invokerFns)) {
    // invoker
    return getHookArgumentsLength(
      Array.isArray(invokerFns) ? invokerFns[0] : invokerFns
    )
  } else {
    // @ts-expect-error
    return (fn._length || fn.length) > 1
  }
}

function _enter(_: any, vnode: VNodeWithData) {
  if (vnode.data.show !== true) {
    enter(vnode)
  }
}

export default inBrowser
  ? {
      create: _enter,
      activate: _enter,
      remove(vnode: VNode, rm: Function) {
        /* istanbul ignore else */
        if (vnode.data!.show !== true) {
          // @ts-expect-error
          leave(vnode, rm)
        } else {
          rm()
        }
      }
    }
  : {}
