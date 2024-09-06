import { warn, hasSymbol, isFunction, isObject } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'
import type { Component } from 'types/component'
import { resolveProvided } from 'v3/apiInject'

// 获取组件提供的配置项 provideOption。
// 如果存在配置项，根据其类型获取实际提供的对象 provided。
// 检查 provided 是否为对象，不是则返回。
// 解析组件上下文中的 source 对象用于存放提供的数据。
// 获取 provided 的所有键名。
// 遍历键名，将 provided 中的属性逐个复制到 source 中，使子组件可以通过 inject 访问这些属性。
export function initProvide(vm: Component) {
  //! 获取provide
  const provideOption = vm.$options.provide
  if (provideOption) {
    const provided = isFunction(provideOption)
      ? provideOption.call(vm)
      : provideOption
    if (!isObject(provided)) {
      return
    }

    const source = resolveProvided(vm)
    // IE9 不支持 Object.getOwnPropertyDescriptors，因此我们必须自己迭代键。
    const keys = hasSymbol ? Reflect.ownKeys(provided) : Object.keys(provided)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      Object.defineProperty(
        source,
        key,
        Object.getOwnPropertyDescriptor(provided, key)!
      )
    }
  }
}
// 解析组件的注入选项并获取注入值。
// 暂停响应式观察。
// 遍历解析结果，为每个注入属性设置响应式，并在开发环境下添加警告回调。
// 恢复响应式观察。
export function initInjections(vm: Component) {
  // ! 获取inject
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    //! 暂停观察
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (__DEV__) {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        //! 注入的属性是响应式的 ，当提供的组件重新渲染时，更改将被覆盖。
        defineReactive(vm, key, result[key])
      }
    })
    //! 恢复观察
    toggleObserving(true)
  }
}
// 初始化结果对象：创建一个空对象 result 用于存储注入的结果。
// 获取注入键值：根据环境选择使用 Reflect.ownKeys 或 Object.keys 获取 inject 对象的所有键。
// 遍历键值：循环处理每个键：
// 跳过键名为 __ob__ 的属性。
// 检查 vm._provided 中是否存在对应的提供键 (provideKey)。
// 如果存在，则将提供的值赋给结果对象。
// 否则，检查是否有默认值，并根据情况调用或直接赋值。
// 开发环境下，如果未找到注入项则发出警告。
// 返回结果：最终返回填充后的 result 对象或 undefined、null。
export function resolveInject(
  inject: any,
  vm: Component
): Record<string, any> | undefined | null {
  if (inject) {
    // inject 是 ：any，因为 flow 不够智能，无法找出缓存的
    const result = Object.create(null)
    const keys = hasSymbol ? Reflect.ownKeys(inject) : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 如果观察到 inject 对象...
      if (key === '__ob__') continue
      const provideKey = inject[key].from
      if (provideKey in vm._provided) {
        result[key] = vm._provided[provideKey]
      } else if ('default' in inject[key]) {
        const provideDefault = inject[key].default
        result[key] = isFunction(provideDefault)
          ? provideDefault.call(vm)
          : provideDefault
      } else if (__DEV__) {
        warn(`Injection "${key as string}" not found`, vm)
      }
    }
    return result
  }
}
