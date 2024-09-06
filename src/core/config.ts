import { no, noop, identity } from 'shared/util'

import { LIFECYCLE_HOOKS } from 'shared/constants'
import type { Component } from 'types/component'

/**
 * @internal
 */
export interface Config {
  // 用户

  // 合并策略
  optionMergeStrategies: { [key: string]: Function }
  // 是否禁止显示警告
  silent: boolean
  // 启动时显示生产模式提示消息？
  productionTip: boolean
  // 是否启用性能
  performance: boolean
  // 是否启用 devtools
  devtools: boolean
  // 观察程序错误的错误处理程序
  errorHandler?: (err: Error, vm: Component | null, info: string) => void
  // 用于观察程序警告的 Warn 处理程序
  warnHandler?: (msg: string, vm: Component | null, trace: string) => void
  //  忽略自定义元素
  ignoredElements: Array<string | RegExp>
  // 自定义密钥别名
  keyCodes: { [key: string]: number | Array<number> }

  // 平台

  // 检查标记是否为保留的，以便无法将其注册为组件。
  isReservedTag: (x: string) => boolean | undefined
  // 检查是否保留了 attribute ，使其不能用作 component prop。
  isReservedAttr: (x: string) => true | undefined
  // 解析平台标签名称
  parsePlatformTagName: (x: string) => string
  // 检查是否为未知元素
  isUnknownElement: (x: string) => boolean
  // 获取元素的命名空间
  getTagNamespace: (x: string) => string | undefined
  // 检查是否必须使用 property 绑定 attribute，例如 value
  mustUseProp: (tag: string, type?: string | null, name?: string) => boolean

  // 私人

  // 异步执行更新。
  async: boolean

  // 遗产

  // 生命周期钩子
  _lifecycleHooks: Array<string>
}

export default {
  /**
   * 选项合并策略（用于 core/util/options）
   */
// $flow禁用行
  optionMergeStrategies: Object.create(null),

  /**
   * 是否禁止显示警告。
   */
  silent: false,

  /**
   * 启动时显示生产模式提示消息？
   */
  productionTip: __DEV__,

  /**
   * 是否启用 devtools
   */
  devtools: __DEV__,

  /**
   * 是否录制性能
   */
  performance: false,

  /**
   * 观察程序错误的错误处理程序
   */
  errorHandler: null,

  /**
   * 用于观察程序警告的 Warn 处理程序
   */
  warnHandler: null,

  /**
   * 忽略某些自定义元素
   */
  ignoredElements: [],

  /**
   * v-on 的自定义用户密钥别名
   */
// $flow禁用行
  keyCodes: Object.create(null),

  /**
   * 检查标记是否被保留，以便无法将其注册为组件。这与平台相关，可能会被覆盖。
   */
  isReservedTag: no,

  /**
   * 检查是否保留了 attribute ，使其不能用作 component prop。这与平台相关，可能会被覆盖。
   */
  isReservedAttr: no,

  /**
   * 检查标签是否为未知元素。
   * 取决于平台。
   */
  isUnknownElement: no,

  /**
   * 获取元素的命名空间
   */
  getTagNamespace: noop,

  /**
   * 解析特定平台的真实标签名称。
   */
  parsePlatformTagName: identity,

  /**
   * 检查是否必须使用 property 绑定 attribute，例如 value
   * 取决于平台。
   */
  mustUseProp: no,

  /**
   * 异步执行更新。旨在供 Vue Test Utils 使用
   * 如果设置为 false，这将显著降低性能。
   */
  async: true,

  /**
   * 因遗留原因而公开
   */
  _lifecycleHooks: LIFECYCLE_HOOKS
} as unknown as Config
