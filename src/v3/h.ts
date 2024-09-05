import { createElement } from '../core/vdom/create-element'
import { currentInstance } from './currentInstance'
import { warn } from 'core/util'

/**
 * @internal此函数需要手动公共类型声明，因为它依赖于
 * 在以前从 Vue 2 手动编写的类型上
 */
export function h(type: any, props?: any, children?: any) {
  if (!currentInstance) {
    __DEV__ &&
      warn(
        `globally imported h() can only be invoked when there is an active ` +
          `component instance, e.g. synchronously in a component's render or setup function.`
      )
  }
  return createElement(currentInstance!, type, props, children, 2, true)
}
