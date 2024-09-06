import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop,
  isFunction
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget, DepTarget } from './dep'
import { DebuggerEvent, DebuggerOptions } from 'v3/debug'

import type { SimpleSet } from '../util/index'
import type { Component } from 'types/component'
import { activeEffectScope, recordEffectScope } from 'v3/reactivity/effectScope'

let uid = 0

/**
 * @internal
 */
export interface WatcherOptions extends DebuggerOptions {
  deep?: boolean
  user?: boolean
  lazy?: boolean
  sync?: boolean
  before?: Function
}

/**
 * 侦听器解析表达式、收集依赖项，并在表达式值更改时触发回调。
 * 这用于 $watch（） API 和指令。
 * @internal
 */

// 该 TypeScript 类 Watcher 实现了依赖追踪与更新机制，主要用于 Vue.js 中的数据监听。具体功能如下：

// 构造函数：初始化观察者实例，设置各种标志位（如 deep, lazy 等），并解析传入的表达式或函数以生成 getter。

// get 方法：执行 getter 函数获取值，并记录依赖关系。

// addDep 方法：向当前观察者添加一个依赖。

// cleanupDeps 方法：清理不再需要的依赖。

// update 方法：当依赖发生变化时被调用，根据配置决定立即更新或延迟更新。

// run 方法：实际执行更新逻辑，计算新值并与旧值比较后回调通知变化。

// evaluate 方法：仅对懒加载观察者有效，用于首次计算其值。

// depend 方法：通知所有依赖进行依赖收集。

// teardown 方法：销毁观察者，移除所有相关联的依赖关系。
export default class Watcher implements DepTarget {
  vm?: Component | null  //组件实例引用。
  expression: string  //数据绑定表达式。
  cb: Function  //更新回调函数。
  id: number  //观察者唯一标识。

  // 标记观察者特性或行为
  deep: boolean  //是否深度观察。
  user: boolean  //是否懒加载。
  lazy: boolean  //是否懒加载。
  sync: boolean  //是否同步更新
  dirty: boolean  //是否已标记为脏（需更新）。
  active: boolean    //是否激活状态。

  //当前和新的依赖列表。
  deps: Array<Dep>
  newDeps: Array<Dep>

  //当前和新的依赖ID集合。
  depIds: SimpleSet
  newDepIds: SimpleSet

  before?: Function  //更新前回调函数。
  onStop?: Function  //停止观察时回调函数。
  noRecurse?: boolean  // 是否禁止递归触发。
  getter: Function  //获取数据值的方法。
  value: any  //当前缓存值。
  post: boolean

  // 仅限 dev
  onTrack?: ((event: DebuggerEvent) => void) | undefined
  onTrigger?: ((event: DebuggerEvent) => void) | undefined

  constructor(
    vm: Component | null,
    expOrFn: string | (() => any),
    cb: Function,
    options?: WatcherOptions | null,
    isRenderWatcher?: boolean
  ) {
    recordEffectScope(
      this,
      // 如果活动效果范围是手动创建的（不是组件范围），
      // 确定 IT 的优先级
      activeEffectScope && !activeEffectScope._vm
        ? activeEffectScope
        : vm
          ? vm._scope
          : undefined
    )
    if ((this.vm = vm) && isRenderWatcher) {
      vm._watcher = this
    }
    // 选项
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
      if (__DEV__) {
        this.onTrack = options.onTrack
        this.onTrigger = options.onTrigger
      }
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // 用于批处理的 uid
    this.active = true
    this.post = false
    this.dirty = this.lazy // 对于懒惰的观察者
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = __DEV__ ? expOrFn.toString() : ''
    // getter 的 Parse 表达式
    if (isFunction(expOrFn)) {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        __DEV__ &&
          warn(
            `Failed watching path: "${expOrFn}" ` +
            'Watcher only accepts simple dot-delimited paths. ' +
            'For full control, use a function instead.',
            vm
          )
      }
    }
    this.value = this.lazy ? undefined : this.get()
  }

  /**
   * 评估 getter，并重新收集依赖项。
   */
  get() {
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e: any) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // “touch” 每个属性，以便将它们全部作为
      // 深度监视的依赖项
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * 向此指令添加依赖项。
   */
  addDep(dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * 清理依赖项集合。
   */
  cleanupDeps() {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp: any = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * 订阅者接口。
   * 将在依赖项更改时调用。
   */
  update() {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler 作业接口。
   * 将由调度程序调用。
   */
  run() {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // 即使值相同，深度观察器和 Object/Arrays 上的 watcher 也应该触发，因为该值可能已经改变。
        isObject(value) ||
        this.deep
      ) {
        // 设置新值
        const oldValue = this.value
        this.value = value
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(
            this.cb,
            this.vm,
            [value, oldValue],
            this.vm,
            info
          )
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * 评估观察程序的值。
   * 这只会为懒惰的观察者调用。
   */
  evaluate() {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * 依赖于此 watcher 收集的所有 deps。
   */
  depend() {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * 从所有依赖项的订阅者列表中删除 self。
   */
  teardown() {
    if (this.vm && !this.vm._isBeingDestroyed) {
      remove(this.vm._scope.effects, this)
    }
    if (this.active) {
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
      if (this.onStop) {
        this.onStop()
      }
    }
  }
}
