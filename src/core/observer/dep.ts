import config from '../config'
import { DebuggerOptions, DebuggerEventExtraInfo } from 'v3'

let uid = 0

const pendingCleanupDeps: Dep[] = []
// 遍历 pendingCleanupDeps 数组中的每个依赖对象。
// 清理每个依赖对象 dep 中的 subs（订阅者）列表，移除无效的订阅者。
// 将每个依赖对象的 _pending 标记设为 false。
// 清空 pendingCleanupDeps 数组。
export const cleanupDeps = () => {
  for (let i = 0; i < pendingCleanupDeps.length; i++) {
    const dep = pendingCleanupDeps[i]
    dep.subs = dep.subs.filter(s => s)
    dep._pending = false
  }
  pendingCleanupDeps.length = 0
}

/**
 * @internal
 */
export interface DepTarget extends DebuggerOptions {
  id: number
  addDep(dep: Dep): void
  update(): void
}

/**
 * dep 是一个 observable，可以有多个指令订阅它。
 * @internal
 */

// 依赖收集：通过 addSub 方法将观察者（DepTarget）添加到 subs 数组中。
// 移除依赖：removeSub 方法从 subs 数组中移除指定观察者，并标记 _pending 为 true，以便后续清理。
// 依赖追踪：depend 方法检查静态属性 target 是否存在，若存在则调用其 addDep 方法并记录调试信息。
// 通知依赖：notify 方法遍历 subs 数组，过滤掉无效项后，按需排序并调用每个观察者的 update 方法，同时记录调试信息。
export default class Dep {
  static target?: DepTarget | null
  id: number
  subs: Array<DepTarget | null>
  // 待处理的 subs 清理
  _pending = false

  constructor() {
    this.id = uid++
    this.subs = []
  }

  addSub(sub: DepTarget) {
    this.subs.push(sub)
  }

  removeSub(sub: DepTarget) {
    // #12696 拥有大量订阅者的 deps 速度非常慢
    // 在 Chromium 中清理
    // 为了解决这个问题，我们现在取消设置 sub，然后清除它们
    // next scheduler flush 的 Flush 命令。
    this.subs[this.subs.indexOf(sub)] = null
    if (!this._pending) {
      this._pending = true
      pendingCleanupDeps.push(this)
    }
  }

  depend(info?: DebuggerEventExtraInfo) {
    if (Dep.target) {
      Dep.target.addDep(this)
      if (__DEV__ && info && Dep.target.onTrack) {
        Dep.target.onTrack({
          effect: Dep.target,
          ...info
        })
      }
    }
  }

  notify(info?: DebuggerEventExtraInfo) {
    // 首先稳定订阅者列表
    const subs = this.subs.filter(s => s) as DepTarget[]
    if (__DEV__ && !config.async) {
      // 如果不运行 async，则不会在 Scheduler 中对 sub 进行排序
      // 我们现在需要对它们进行排序，以确保它们正确触发
      // 次序
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      const sub = subs[i]
      if (__DEV__ && info) {
        sub.onTrigger &&
          sub.onTrigger({
            effect: subs[i],
            ...info
          })
      }
      sub.update()
    }
  }
}

// 正在评估的当前目标观察程序。
// 这是全局唯一的，因为一次只能评估一个 watcher。
Dep.target = null
const targetStack: Array<DepTarget | null | undefined> = []

// 该函数将给定的 DepTarget 对象推入 targetStack 数组，并同时将其赋值给 Dep.target。
// 这通常用于在执行依赖追踪时，记录当前操作的目标对象。
export function pushTarget(target?: DepTarget | null) {
  targetStack.push(target)
  Dep.target = target
}
// 从栈顶移除一个元素。
// 将栈的新顶部元素赋值给Dep.target，若栈为空，则Dep.target设为undefined。
export function popTarget() {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
