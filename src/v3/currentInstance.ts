import { Component } from 'types/component'

export let currentInstance: Component | null = null

/**
 * 这是为了与 v3 兼容而公开的（例如，VueUse 中的某些函数依赖于它）。 不要在内部使用它，只使用 'currentInstance'。
 *
 * @internal这个函数需要手动类型声明，因为它依赖于
 * 在以前从 Vue 2 手动编写的类型上
 */
export function getCurrentInstance(): { proxy: Component } | null {
  return currentInstance && { proxy: currentInstance }
}

/**
 * @internal
 */
export function setCurrentInstance(vm: Component | null = null) {
  if (!vm) currentInstance && currentInstance._scope.off()
  currentInstance = vm
  vm && vm._scope.on()
}
