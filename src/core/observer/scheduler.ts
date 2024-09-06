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

// 将 index、queue 的长度和 activatedChildren 的长度设为 0。
// 清空 has 对象。
// 如果在开发模式下（__DEV__），清空 circular 对象。
// 将 waiting 和 flushing 标志设为 false。
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
// 当 a.post 为真，b.post 为假，返回1。
// 当 a.post 为假，b.post 为真，返回-1。
// 否则，按 a.id 和 b.id 的差值返回结果。
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

// 此函数flushSchedulerQueue用于刷新并执行两个队列中的观察者：

// 对队列进行排序，确保组件按父子顺序更新，并优先执行用户观察者。
// 循环遍历队列，执行每个观察者的before钩子（若有），然后运行观察者。
// 在开发环境下检测循环更新，超过限制则发出警告。
// 重置调度状态后，调用激活和更新钩子，清理依赖。
// 触发devtool钩子记录调试信息。
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
// 该函数callUpdatedHooks遍历传入的Watcher[]列表，依次检查每个Watcher对象关联的组件实例vm是否已挂载且未销毁。
// 若条件满足，则调用该实例的生命周期钩子updated。主要用于Vue.js中更新后的生命周期管理。
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

// 该函数将组件 vm 的 _inactive 属性设置为 false，使其变为激活状态，以便渲染函数能正确识别其状态。
// 随后将 vm 添加到 activatedChildren 数组中，用于跟踪激活的子组件。
export function queueActivatedComponent(vm: Component) {
  // 在此处将 _inactive 设置为 false，以便 render 函数可以
  // 依赖于检查它是否在非活动树中（例如 router-view）
  vm._inactive = false
  activatedChildren.push(vm)
}
// 该函数遍历传入的组件队列，并将每个组件的 _inactive 属性设为 true，
// 然后调用 activateChildComponent 函数激活组件，但参数中的 true 表示的具体含义未在函数内明确说明。
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

// 检查观察者是否已存在队列中，若已存在则直接返回。
// 避免递归调用自身时重复入队。
// 若当前未在执行队列中的任务，则直接将观察者添加到队尾；若正在执行，则按观察者的ID顺序插入队列。
// 若尚未开始处理队列，则标记为等待状态，并在下一个事件循环开始时执行队列中的所有观察者。
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
