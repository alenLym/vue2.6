// 帮助程序处理 v-bind 和 v-on 中动态参数的动态键。
// 例如，以下模板：
//
// <div id=“app” ：[key]=“value”>
//
// 编译为以下内容：
//
// _c（'div'， { attrs： bindDynamicKeys（{ “id”： “app” }， [key， value]） }）

import { warn } from 'core/util/debug'

export function bindDynamicKeys(
  baseObj: Record<string, any>,
  values: Array<any>
): Object {
  for (let i = 0; i < values.length; i += 2) {
    const key = values[i]
    if (typeof key === 'string' && key) {
      baseObj[values[i]] = values[i + 1]
    } else if (__DEV__ && key !== '' && key !== null) {
      // null 是显式删除绑定的特殊值
      warn(
        `Invalid value for dynamic directive argument (expected string or null): ${key}`,
        this
      )
    }
  }
  return baseObj
}

// helper 将修饰符运行时标记动态附加到事件名称。
// 确保仅在 value 已为 String 时追加，否则将被强制转换
// 设置为 string，并导致类型检查未命中。
export function prependModifier(value: any, symbol: string): any {
  return typeof value === 'string' ? symbol + value : value
}
