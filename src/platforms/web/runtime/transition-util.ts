import { inBrowser, isIE9 } from 'core/util/index'
import { addClass, removeClass } from 'web/runtime/class-util'
import { remove, extend, cached } from 'shared/util'

export function resolveTransition(
  def?: string | Record<string, any>
): Record<string, any> | undefined {
  if (!def) {
    return
  }
  /* istanbul ignore else */
  if (typeof def === 'object') {
    const res = {}
    if (def.css !== false) {
      extend(res, autoCssTransition(def.name || 'v'))
    }
    extend(res, def)
    return res
  } else if (typeof def === 'string') {
    return autoCssTransition(def)
  }
}

const autoCssTransition: (name: string) => Object = cached(name => {
  return {
    enterClass: `${name}-enter`,
    enterToClass: `${name}-enter-to`,
    enterActiveClass: `${name}-enter-active`,
    leaveClass: `${name}-leave`,
    leaveToClass: `${name}-leave-to`,
    leaveActiveClass: `${name}-leave-active`
  }
})

export const hasTransition = inBrowser && !isIE9
const TRANSITION = 'transition'
const ANIMATION = 'animation'

// Transition 属性/事件探查
export let transitionProp = 'transition'
export let transitionEndEvent = 'transitionend'
export let animationProp = 'animation'
export let animationEndEvent = 'animationend'
if (hasTransition) {
  /* istanbul ignore if */
  if (
    window.ontransitionend === undefined &&
    window.onwebkittransitionend !== undefined
  ) {
    transitionProp = 'WebkitTransition'
    transitionEndEvent = 'webkitTransitionEnd'
  }
  if (
    window.onanimationend === undefined &&
    window.onwebkitanimationend !== undefined
  ) {
    animationProp = 'WebkitAnimation'
    animationEndEvent = 'webkitAnimationEnd'
  }
}

// 绑定到窗口是必要的，才能使热重载在 IE 中以严格模式工作
const raf = inBrowser
  ? window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : setTimeout
  : /* istanbul ignore next */ fn => fn()

export function nextFrame(fn: Function) {
  raf(() => {
    // @ts-expect-error
    raf(fn)
  })
}

export function addTransitionClass(el: any, cls: string) {
  const transitionClasses =
    el._transitionClasses || (el._transitionClasses = [])
  if (transitionClasses.indexOf(cls) < 0) {
    transitionClasses.push(cls)
    addClass(el, cls)
  }
}

export function removeTransitionClass(el: any, cls: string) {
  if (el._transitionClasses) {
    remove(el._transitionClasses, cls)
  }
  removeClass(el, cls)
}

export function whenTransitionEnds(
  el: Element,
  expectedType: string | undefined,
  cb: Function
) {
  const { type, timeout, propCount } = getTransitionInfo(el, expectedType)
  if (!type) return cb()
  const event: string =
    type === TRANSITION ? transitionEndEvent : animationEndEvent
  let ended = 0
  const end = () => {
    el.removeEventListener(event, onEnd)
    cb()
  }
  const onEnd = e => {
    if (e.target === el) {
      if (++ended >= propCount) {
        end()
      }
    }
  }
  setTimeout(() => {
    if (ended < propCount) {
      end()
    }
  }, timeout + 1)
  el.addEventListener(event, onEnd)
}

const transformRE = /\b(transform|all)(,|$)/

export function getTransitionInfo(
  el: Element,
  expectedType?: string
): {
  type?: string | null
  propCount: number
  timeout: number
  hasTransform: boolean
} {
  const styles: any = window.getComputedStyle(el)
  // JSDOM 可能会为 transition 属性返回 undefined
  const transitionDelays: Array<string> = (
    styles[transitionProp + 'Delay'] || ''
  ).split(', ')
  const transitionDurations: Array<string> = (
    styles[transitionProp + 'Duration'] || ''
  ).split(', ')
  const transitionTimeout: number = getTimeout(
    transitionDelays,
    transitionDurations
  )
  const animationDelays: Array<string> = (
    styles[animationProp + 'Delay'] || ''
  ).split(', ')
  const animationDurations: Array<string> = (
    styles[animationProp + 'Duration'] || ''
  ).split(', ')
  const animationTimeout: number = getTimeout(
    animationDelays,
    animationDurations
  )

  let type: string | undefined | null
  let timeout = 0
  let propCount = 0
  /* istanbul ignore if */
  if (expectedType === TRANSITION) {
    if (transitionTimeout > 0) {
      type = TRANSITION
      timeout = transitionTimeout
      propCount = transitionDurations.length
    }
  } else if (expectedType === ANIMATION) {
    if (animationTimeout > 0) {
      type = ANIMATION
      timeout = animationTimeout
      propCount = animationDurations.length
    }
  } else {
    timeout = Math.max(transitionTimeout, animationTimeout)
    type =
      timeout > 0
        ? transitionTimeout > animationTimeout
          ? TRANSITION
          : ANIMATION
        : null
    propCount = type
      ? type === TRANSITION
        ? transitionDurations.length
        : animationDurations.length
      : 0
  }
  const hasTransform: boolean =
    type === TRANSITION && transformRE.test(styles[transitionProp + 'Property'])
  return {
    type,
    timeout,
    propCount,
    hasTransform
  }
}

function getTimeout(delays: Array<string>, durations: Array<string>): number {
  /* istanbul ignore next */
  while (delays.length < durations.length) {
    delays = delays.concat(delays)
  }

  return Math.max.apply(
    null,
    durations.map((d, i) => {
      return toMs(d) + toMs(delays[i])
    })
  )
}

// 旧版本的 Chromium（低于 61.0.3163.100）以与区域设置相关的方式格式化浮动指针数字，使用逗号而不是点。
// 如果逗号没有被点替换，则输入将被向下舍入（即充当向下取整函数），从而导致意外行为
function toMs(s: string): number {
  return Number(s.slice(0, -1).replace(',', '.')) * 1000
}
