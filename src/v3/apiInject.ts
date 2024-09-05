import { isFunction, warn } from 'core/util'
import { currentInstance } from './currentInstance'
import type { Component } from 'types/component'

export interface InjectionKey<T> extends Symbol {}

export function provide<T>(key: InjectionKey<T> | string | number, value: T) {
  if (!currentInstance) {
    if (__DEV__) {
      warn(`provide() can only be used inside setup().`)
    }
  } else {
    // TS 不允许将 symbol 作为索引类型
    resolveProvided(currentInstance)[key as string] = value
  }
}

export function resolveProvided(vm: Component): Record<string, any> {
  // 默认情况下，实例会继承其父级的 Provides 对象
// 但是当它需要提供自己的值时，它会创建其
// own 提供对象 使用 parent 提供对象作为原型。
// 这样在 'inject' 中，我们可以简单地从 Direct 中查找注入
// parent 并让原型链完成工作。
  const existing = vm._provided
  const parentProvides = vm.$parent && vm.$parent._provided
  if (parentProvides === existing) {
    return (vm._provided = Object.create(parentProvides))
  } else {
    return existing
  }
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false
): T
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true
): T
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false
) {
  // 回退到 'currentRenderingInstance' 中，以便可以在
// 功能组件
  const instance = currentInstance
  if (instance) {
    // #2400
// 要支持 'app.use' 插件，
// 如果实例位于根目录，则回退到 appContext 的 'provides'
    const provides = instance.$parent && instance.$parent._provided

    if (provides && (key as string | symbol) in provides) {
      // TS doesn't allow symbol as index type
      return provides[key as string]
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance)
        : defaultValue
    } else if (__DEV__) {
      warn(`injection "${String(key)}" not found.`)
    }
  } else if (__DEV__) {
    warn(`inject() can only be used inside setup() or functional components.`)
  }
}
