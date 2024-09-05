import config from '../config'
import Watcher, { WatcherOptions } from '../observer/watcher'
import { mark, measure } from '../util/perf'
import VNode, { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'
import type { Component } from 'types/component'
import type { MountedComponentVNode } from 'types/vnode'

import {
  warn,
  noop,
  remove,
  emptyObject,
  validateProp,
  invokeWithErrorHandling
} from '../util/index'
import { currentInstance, setCurrentInstance } from 'v3/currentInstance'
import { getCurrentScope } from 'v3/reactivity/effectScope'
import { syncSetupProxy } from 'v3/apiSetup'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

export function setActiveInstance(vm: Component) {
  const prevActiveInstance = activeInstance
  activeInstance = vm
  return () => {
    activeInstance = prevActiveInstance
  }
}

export function initLifecycle(vm: Component) {
  const options = vm.$options

  // 找到第一个非抽象父级
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }

  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  vm.$children = []
  vm.$refs = {}

  vm._provided = parent ? parent._provided : Object.create(null)
  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

export function lifecycleMixin(Vue: typeof Component) {
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const restoreActiveInstance = setActiveInstance(vm)
    vm._vnode = vnode
    // Vue.prototype.__patch__根据使用的渲染后端注入到入口点中。
    if (!prevVnode) {
      // 初始渲染
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // 更新
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    restoreActiveInstance()
    // 更新 __vue__ 参考
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // 如果 parent 是 HOC，则还要更新其 $el
    let wrapper: Component | undefined = vm
    while (
      wrapper &&
      wrapper.$vnode &&
      wrapper.$parent &&
      wrapper.$vnode === wrapper.$parent._vnode
    ) {
      wrapper.$parent.$el = wrapper.$el
      wrapper = wrapper.$parent
    }
    // updated 钩子被调度器调用，以确保子
    // updated 的 hook 中。
  }

  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  Vue.prototype.$destroy = function () {
    const vm: Component = this
    if (vm._isBeingDestroyed) {
      return
    }
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // Remove Self from Parent（从父项中删除自身）
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // teardown 范围。这包括 Render Watcher 和其他
    // 已创建 Watchers
    vm._scope.stop()
    // 从数据 OB 中删除引用
    // 冻结的对象可能没有 Observer。
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // 调用最后一个钩子...
    vm._isDestroyed = true
    // 在当前渲染的树上调用 Destroy 钩子
    vm.__patch__(vm._vnode, null)
    // 火烧毁了钩子
    callHook(vm, 'destroyed')
    // 关闭所有实例侦听器。
    vm.$off()
    // 删除__vue__引用
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // 发布循环引用 （#6759）
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

export function mountComponent(
  vm: Component,
  el: Element | null | undefined,
  hydrating?: boolean
): Component {
  vm.$el = el
  if (!vm.$options.render) {
    // @ts-expect-error 类型无效
    vm.$options.render = createEmptyVNode
    if (__DEV__) {
      /* istanbul ignore if */
      if (
        (vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el ||
        el
      ) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  if (__DEV__ && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  const watcherOptions: WatcherOptions = {
    before() {
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }

  if (__DEV__) {
    watcherOptions.onTrack = e => callHook(vm, 'renderTracked', [e])
    watcherOptions.onTrigger = e => callHook(vm, 'renderTriggered', [e])
  }

  // 我们在 watcher 的构造函数中将其设置为 vm._watcher
  // 由于 watcher 的初始 patch 可能会调用 $forceUpdate（例如在 child 中
  // 组件的 mounted 钩子），它依赖于已经定义的 vm._watcher
  new Watcher(
    vm,
    updateComponent,
    noop,
    watcherOptions,
    true /* 是渲染观察器*/
  )
  hydrating = false

  // flush buffer for flush： “pre” watchers in setup（） 中排队
  const preWatchers = vm._preWatchers
  if (preWatchers) {
    for (let i = 0; i < preWatchers.length; i++) {
      preWatchers[i].run()
    }
  }

  // 手动挂载的实例，调用 mounted on self
  // mounted 在其插入的钩子中为渲染创建的子组件调用
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

export function updateChildComponent(
  vm: Component,
  propsData: Record<string, any> | null | undefined,
  listeners: Record<string, Function | Array<Function>> | undefined,
  parentVnode: MountedComponentVNode,
  renderChildren?: Array<VNode> | null
) {
  if (__DEV__) {
    isUpdatingChildComponent = true
  }

  // 确定组件是否具有插槽子项
  // 我们需要在覆盖 $options._renderChildren 之前执行此操作。

  // 检查是否有动态 scopedSlots（手写或编译，但带有
  // 动态插槽名称）。从模板编译的静态作用域插槽具有
  // “$stable”标记。
  const newScopedSlots = parentVnode.data.scopedSlots
  const oldScopedSlots = vm.$scopedSlots
  const hasDynamicScopedSlot = !!(
    (newScopedSlots && !newScopedSlots.$stable) ||
    (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) ||
    (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key) ||
    (!newScopedSlots && vm.$scopedSlots.$key)
  )

  // 在父级更新期间，父级中的任何静态插槽子级都可能已更改。动态范围的槽也可能已更改。在这种情况下，必须强制更新以确保正确性。
  let needsForceUpdate = !!(
    renderChildren || // 具有新的静态插槽
    vm.$options._renderChildren || // 具有旧的静态插槽
    hasDynamicScopedSlot
  )

  const prevVNode = vm.$vnode
  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // 更新 VM 的占位符节点而不重新渲染

  if (vm._vnode) {
    // 更新子树的父级
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // 更新 $attrs 和 $listeners 哈希
  // 这些也是响应式的，因此如果
  // 在渲染期间使用它们
  const attrs = parentVnode.data.attrs || emptyObject
  if (vm._attrsProxy) {
    // 如果 Attrs 被访问并已更改，则强制更新，因为它可能是
    // 传递给子组件。
    if (
      syncSetupProxy(
        vm._attrsProxy,
        attrs,
        (prevVNode.data && prevVNode.data.attrs) || emptyObject,
        vm,
        '$attrs'
      )
    ) {
      needsForceUpdate = true
    }
  }
  vm.$attrs = attrs

  // 更新侦听器
  listeners = listeners || emptyObject
  const prevListeners = vm.$options._parentListeners
  if (vm._listenersProxy) {
    syncSetupProxy(
      vm._listenersProxy,
      listeners,
      prevListeners || emptyObject,
      vm,
      '$listeners'
    )
  }
  vm.$listeners = vm.$options._parentListeners = listeners
  updateComponentListeners(vm, listeners, prevListeners)

  // 更新 props
  if (propsData && vm.$options.props) {
    toggleObserving(false)
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      const propOptions: any = vm.$options.props // 什么鬼，流程？
      props[key] = validateProp(key, propOptions, propsData, vm)
    }
    toggleObserving(true)
    // 保留原始 propsData 的副本
    vm.$options.propsData = propsData
  }

  // 解决槽 + 强制更新（如果有子项）
  if (needsForceUpdate) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (__DEV__) {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree(vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

export function activateChildComponent(vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent(vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

export function callHook(
  vm: Component,
  hook: string,
  args?: any[],
  setContext = true
) {
  // #7573 在调用生命周期钩子时禁用 dep 集合
  pushTarget()
  const prevInst = currentInstance
  const prevScope = getCurrentScope()
  setContext && setCurrentInstance(vm)
  const handlers = vm.$options[hook]
  const info = `${hook} hook`
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      invokeWithErrorHandling(handlers[i], vm, args || null, vm, info)
    }
  }
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
  if (setContext) {
    setCurrentInstance(prevInst)
    prevScope && prevScope.on()
  }

  popTarget()
}
