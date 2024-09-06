import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'
import type { Component } from 'types/component'
import type { InternalComponentOptions } from 'types/options'
import { EffectScope } from 'v3/reactivity/effectScope'

let uid = 0
// 为实例分配唯一UID和设置内部标识 _isVue 和 __v_skip。
// 创建并配置效果范围 _scope。
// 合并选项：根据是否为内部组件选择不同的合并方式。
// 初始化代理、生命周期、事件、渲染等核心功能。
// 调用生命周期钩子 beforeCreate 和 created。
// 若指定挂载元素，则进行挂载。
export function initMixin(Vue: typeof Component) {
  Vue.prototype._init = function (options?: Record<string, any>) {
    const vm: Component = this
    // 一个 UID
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (__DEV__ && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // 一个标志，用于将其标记为 Vue 实例，而无需执行 instanceof
    // 检查
    vm._isVue = true
    // 避免实例被观察
    vm.__v_skip = true
    // 效果范围
    vm._scope = new EffectScope(true /* detached */)
    // #13134 在
    // 父组件的 render
    vm._scope.parent = undefined
    vm._scope._vm = true
    // merge options
    if (options && options._isComponent) {
      // 优化内部组件实例化
      // 由于 Dynamic Options 合并非常缓慢，并且没有
      // 内部组件选项需要特殊处理。
      initInternalComponent(vm, options as any)
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor as any),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (__DEV__) {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // 暴露真实的自我
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate', undefined, false /* setContext */)
    initInjections(vm) // 在 data/props 之前解决注入
    initState(vm)
    initProvide(vm) // 在 data/props 之后解析 Provide
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (__DEV__ && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}
// 设置组件选项：通过继承构造函数的选项创建新对象，并赋值给vm.$options。
// 更新父节点信息：设置父节点VNode和组件选项，如属性数据、监听器、子组件及标签名。
// 可选渲染函数：如果提供了渲染函数，则更新相关选项。
export function initInternalComponent(
  vm: Component,
  options: InternalComponentOptions
) {
  const opts = (vm.$options = Object.create((vm.constructor as any).options))
  // 这样做是因为它比动态枚举更快。
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions!
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}
// 获取构造器的选项。
// 如果存在父级构造器，则递归解析父级选项，并检查是否发生变化。
// 若父级选项变化，更新构造器的父级选项，并合并可能存在的延迟修改。
// 合并父级选项与扩展选项，并更新组件名称对应的构造器。返回最终的选项。
export function resolveConstructorOptions(Ctor: typeof Component) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super 选项已更改，
      // 需要解决新的选项。
      Ctor.superOptions = superOptions
      // 检查是否有任何延迟修改/附加的选项 （#4976）
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // 更新基础扩展选项
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}
// 该函数resolveModifiedOptions接收一个名为Ctor的类类型参数，该类具有options和sealedOptions属性。
// 函数遍历latest（即Ctor.options）的所有键，如果某个键的值与sealed（即Ctor.sealedOptions）
// 中的对应值不同，则将这个键及其值存入modified对象中。最后返回modified对象或null。
// 主要功能是找出并返回修改过的选项。
function resolveModifiedOptions(
  Ctor: typeof Component
): Record<string, any> | null {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
