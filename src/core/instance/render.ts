import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive,
  isArray
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'
import type { Component } from 'types/component'
import { currentInstance, setCurrentInstance } from 'v3/currentInstance'
import { syncSetupSlots } from 'v3/apiSetup'
// 设置组件子树和静态节点缓存。
// 获取父节点信息并解析插槽。
// 绑定 createElement 方法到组件实例，提供内部 _c 和公共 $createElement 方法。
// 设置响应式属性 $attrs 和 $listeners，并在开发模式下添加只读警告。
export function initRender(vm: Component) {
  vm._vnode = null // 子树的根
  vm._staticTrees = null // v-once 缓存树
  const options = vm.$options
  const parentVnode = (vm.$vnode = options._parentVnode!) // 父树中的 placeholder 节点
  const renderContext = parentVnode && (parentVnode.context as Component)
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = parentVnode
    ? normalizeScopedSlots(
      vm.$parent!,
      parentVnode.data!.scopedSlots,
      vm.$slots
    )
    : emptyObject
  // 将 createElement fn 绑定到此实例
  // 这样我们就可以在其中获得适当的渲染上下文。
  // 参数顺序：tag、data、children、normalizationType、alwaysNormalize
  // internal 版本由从模板编译的 render 函数使用
  // @ts期望错误
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // 规范化始终应用于 Public 版本，用于
  // 用户编写的 render 函数。
  // @ts期望错误
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners 被公开，以便于创建 HOC。
  // 它们需要是响应式的，以便使用它们的 HOC 始终处于更新
  const parentData = parentVnode && parentVnode.data

  /* istanbul ignore else */
  if (__DEV__) {
    defineReactive(
      vm,
      '$attrs',
      (parentData && parentData.attrs) || emptyObject,
      () => {
        !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
      },
      true
    )
    defineReactive(
      vm,
      '$listeners',
      options._parentListeners || emptyObject,
      () => {
        !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
      },
      true
    )
  } else {
    defineReactive(
      vm,
      '$attrs',
      (parentData && parentData.attrs) || emptyObject,
      null,
      true
    )
    defineReactive(
      vm,
      '$listeners',
      options._parentListeners || emptyObject,
      null,
      true
    )
  }
}

export let currentRenderingInstance: Component | null = null

// 仅用于测试
export function setCurrentRenderingInstance(vm: Component) {
  currentRenderingInstance = vm
}
// 安装渲染辅助函数：通过 installRenderHelpers 方法为 Vue 实例原型添加渲染相关的辅助方法。
// 实现 $nextTick 方法：允许用户在 DOM 更新后执行回调函数。
// 定义 _render 方法：
// 处理作用域插槽。
// 设置当前组件的父虚拟节点 ($vnode)。
// 调用 render 函数生成虚拟节点。
// 捕获渲染过程中的错误，并提供错误处理机制。
// 确保返回单个根节点或空虚拟节点。
export function renderMixin(Vue: typeof Component) {
  // 安装 Runtime Convenience Helpers
  installRenderHelpers(Vue.prototype)

  Vue.prototype.$nextTick = function (fn: (...args: any[]) => any) {
    return nextTick(fn, this)
  }

  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const { render, _parentVnode } = vm.$options

    if (_parentVnode && vm._isMounted) {
      vm.$scopedSlots = normalizeScopedSlots(
        vm.$parent!,
        _parentVnode.data!.scopedSlots,
        vm.$slots,
        vm.$scopedSlots
      )
      if (vm._slotsProxy) {
        syncSetupSlots(vm._slotsProxy, vm.$scopedSlots)
      }
    }

    // 设置 Parent vnode。这允许 render 函数访问
    // 添加到占位符节点上的数据。
    vm.$vnode = _parentVnode!
    // 渲染自身
    const prevInst = currentInstance
    const prevRenderInst = currentRenderingInstance
    let vnode
    try {
      setCurrentInstance(vm)
      currentRenderingInstance = vm
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e: any) {
      handleError(e, vm, `render`)
      // 返回错误渲染结果，
      // 或上一个 vnode 来防止渲染错误导致空白组件
      /* istanbul ignore else */
      if (__DEV__ && vm.$options.renderError) {
        try {
          vnode = vm.$options.renderError.call(
            vm._renderProxy,
            vm.$createElement,
            e
          )
        } catch (e: any) {
          handleError(e, vm, `renderError`)
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    } finally {
      currentRenderingInstance = prevRenderInst
      setCurrentInstance(prevInst)
    }
    // 如果返回的数组仅包含单个节点，则允许它
    if (isArray(vnode) && vnode.length === 1) {
      vnode = vnode[0]
    }
    // 如果 render 函数出错，则返回空 vnode
    if (!(vnode instanceof VNode)) {
      if (__DEV__ && isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // 设置父级
    vnode.parent = _parentVnode
    return vnode
  }
}
