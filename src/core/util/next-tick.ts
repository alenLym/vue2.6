/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false

const callbacks: Array<Function> = []
let pending = false

function flushCallbacks() {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// 这里我们有了使用微任务的异步延迟包装器。
// 在 2.5 中，我们使用了（宏）任务（与微任务相结合）。
// 但是，如果在重绘之前更改状态，则存在细微的问题
// （例如 #6813，out-in 过渡）。
// 此外，在事件处理程序中使用（宏）任务会导致一些无法规避的奇怪行为（例如 #7109、#7153、#7546、#7834、#8109）。
// 因此，我们现在再次在任何地方使用微任务。
// 这种权衡的一个主要缺点是，在某些情况下，微任务的优先级太高，并在所谓的顺序事件之间（例如 #4521、#6690，有解决方法）甚至在同一事件的冒泡之间触发 （#6566）。
let timerFunc

// nextTick 行为利用了微任务队列，该队列可以通过原生 Promise.then 或 MutationObserver 访问。
// MutationObserver 具有更广泛的支持，但它在
// iOS 中的 UIWebView >= 9.3.3 在触摸事件处理程序中触发时。触发几次后完全停止工作......因此，如果 Native
// Promise 可用，我们将使用它：istanbul ignore next，$flow-disable-line
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    // 在有问题的 UIWebView 中，Promise.then 并没有完全崩溃，但它可能会陷入一种奇怪的状态，即回调被推送到微任务队列中，但队列没有被刷新，直到浏览器需要做一些其他工作，例如处理计时器。因此，我们可以
// 通过添加空计时器来 “强制” 刷新 MicroTask 队列。
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (
  !isIE &&
  typeof MutationObserver !== 'undefined' &&
  (isNative(MutationObserver) ||
    // PhantomJS and iOS 7.x
    MutationObserver.toString() === '[object MutationObserverConstructor]')
) {
  // 在原生 Promise 不可用的地方使用 MutationObserver，例如 PhantomJS、iOS7、Android 4.4
// （#6466 MutationObserver 在 IE11 中不可靠）
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // 回退到 setImmediate。
// 从技术上讲，它利用了（宏）任务队列，但它仍然是比 setTimeout 更好的选择。
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  // 回退到 setTimeout 中。
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

export function nextTick(): Promise<void>
export function nextTick<T>(this: T, cb: (this: T, ...args: any[]) => any): void
export function nextTick<T>(cb: (this: T, ...args: any[]) => any, ctx: T): void
/**
 * @internal
 */
export function nextTick(cb?: (...args: any[]) => any, ctx?: object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e: any) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true
    timerFunc()
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
