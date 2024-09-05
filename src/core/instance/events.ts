import type { Component } from 'types/component'
import {
  tip,
  toArray,
  isArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents(vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // 初始化父级附加事件
  //! 获取父级附加事件
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add(event, fn) {
  target.$on(event, fn)
}

function remove(event, fn) {
  target.$off(event, fn)
}

function createOnceHandler(event, fn) {
  const _target = target
  return function onceHandler() {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners(
  vm: Component,
  listeners: Object,
  oldListeners?: Object | null
) {
  target = vm
  updateListeners(
    listeners,
    oldListeners || {},
    add,
    remove,
    createOnceHandler,
    vm
  )
  target = undefined
}

export function eventsMixin(Vue: typeof Component) {
  const hookRE = /^hook:/
  Vue.prototype.$on = function (
    event: string | Array<string>,
    fn: Function
  ): Component {
    const vm: Component = this
    if (isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      ; (vm._events[event] || (vm._events[event] = [])).push(fn)
      // 通过使用注册时标记的布尔标志来优化 hook：event 成本
      // 而不是哈希查找
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on() {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  Vue.prototype.$off = function (
    event?: string | Array<string>,
    fn?: Function
  ): Component {
    const vm: Component = this
    // 都
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // 事件数组
    if (isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // 特定事件
    const cbs = vm._events[event!]
    if (!cbs) {
      return vm
    }
    if (!fn) {
      vm._events[event!] = null
      return vm
    }
    // 特定处理程序
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (__DEV__) {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(
            vm
          )} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(
            event
          )}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
