import type Watcher from './watcher'
import config from '../config'
import Dep, { cleanupDeps } from './dep'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import { warn, nextTick, devtools, inBrowser, isIE } from '../util/index'
import type { Component } from 'types/component'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: true | undefined | null } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * 重置调度程序的状态。
 */
function resetSchedulerState() {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (__DEV__) {
    circular = {}
  }
  waiting = flushing = false
}

// 异步边缘情况 #6566 需要在附加事件侦听器时保存时间戳。但是，调用 performance.now（） 会产生性能开销，尤其是在页面有数千个事件侦听器的情况下。相反，我们在每次调度程序 flush 时都会获取一个时间戳，并将其用于该 flush 期间附加的所有事件侦听器。
export let currentFlushTimestamp = 0

// 异步边缘情况修复需要存储事件侦听器的 attach 时间戳。
let getNow: () => number = Date.now

// 确定浏览器使用的事件时间戳。令人讨厌的是，时间戳可以是 hi-res（相对于页面加载）或 low-res
// （相对于 UNIX 纪元），因此为了比较时间，我们必须使用
// 保存 flush 时间戳时，时间戳类型相同。
// 所有 IE 版本都使用低分辨率事件时间戳，并且存在 clock implementations（#9632）
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // 如果事件时间戳（尽管在 Date.now（） 之后计算）为
    // 小于它，则表示事件使用的是高分辨率时间戳，
    // 我们需要将 Hi-Res 版本用于事件监听器时间戳，如
    // 井。
    getNow = () => performance.now()
  }
}

const sortCompareFn = (a: Watcher, b: Watcher): number => {
  if (a.post) {
    if (!b.post) return 1
  } else if (b.post) {
    return -1
  }
  return a.id - b.id
}

/**
 * 刷新两个队列并运行观察程序。
 */
function flushSchedulerQueue() {
  currentFlushTimestamp = getNow()
  flushing = true
  let watcher, id

  // 在 flush 之前对队列进行排序。
  // 这可确保：
  // 1. 组件从父组件更新为子组件。（因为 parent 始终是
  //    在 Child 之前创建）
  // 2. 组件的用户观察器在其渲染观察器之前运行（因为
  //    用户观察者是在渲染观察者之前创建的）
  // 3. 如果组件在父组件的 watcher 运行期间被销毁，
  //    可以跳过它的 watchers。
  queue.sort(sortCompareFn)

  // 不要缓存长度，因为可能会推送更多侦听器
  // 当我们运行现有 watchers 时
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    watcher.run()
    // 在 Dev Build 中，检查并停止循环更新。
    if (__DEV__ && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' +
          (watcher.user
            ? `in watcher with expression "${watcher.expression}"`
            : `in a component render function.`),
          watcher.vm
        )
        break
      }
    }
  }

  // 在重置状态之前保留 POST 队列的副本
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // 调用组件更新并激活了钩子
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)
  cleanupDeps()

  // devtool 钩子
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks(queue: Watcher[]) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm && vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * 将 patch（修补）期间激活的 keept-alive 组件排队。
 * 修补整个树后，将处理队列。
 */
export function queueActivatedComponent(vm: Component) {
  // 在此处将 _inactive 设置为 false，以便 render 函数可以
  // 依赖于检查它是否在非活动树中（例如 router-view）
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks(queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * 将观察程序推送到观察程序队列中。
 * 除非在刷新队列时推送具有重复 ID 的作业，否则将跳过该作业。
 */
export function queueWatcher(watcher: Watcher) {
  const id = watcher.id
  if (has[id] != null) {
    return
  }

  if (watcher === Dep.target && watcher.noRecurse) {
    return
  }

  has[id] = true
  if (!flushing) {
    queue.push(watcher)
  } else {
    // 如果已经 flush，则根据 watcher 的 id 拼接 Watcher
    // 如果已超过其 ID，它将立即运行 Next。
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }
  // 将 flush 排队
  if (!waiting) {
    waiting = true

    if (__DEV__ && !config.async) {
      flushSchedulerQueue()
      return
    }
    nextTick(flushSchedulerQueue)
  }
}
