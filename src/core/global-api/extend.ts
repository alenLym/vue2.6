import { ASSET_TYPES } from 'shared/constants'
import type { Component } from 'types/component'
import type { GlobalAPI } from 'types/global-api'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'
import { getComponentName } from '../vdom/create-component'

export function initExtend(Vue: GlobalAPI) {
  /**
   * 每个实例构造函数（包括 Vue）都有一个唯一的 cid。这使我们能够为 prototypal 继承创建包装的 “child constructor” 并缓存它们。
   */
  Vue.cid = 0
  let cid = 1

  /**
   * 类继承
   */
  Vue.extend = function (extendOptions: any): typeof Component {
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    const name =
      getComponentName(extendOptions) || getComponentName(Super.options)
    if (__DEV__ && name) {
      validateComponentName(name)
    }

    const Sub = function VueComponent(this: any, options: any) {
      this._init(options)
    } as unknown as typeof Component
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
    Sub.options = mergeOptions(Super.options, extendOptions)
    Sub['super'] = Super

    // 对于 props 和计算属性，我们在扩展时在扩展原型上定义 Vue 实例上的代理 getter。这样可以避免对创建的每个实例进行 Object.defineProperty 调用。
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // 允许进一步使用 extension/mixin/plugin
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // 创建资产寄存器，因此扩展类
// 也可以拥有他们的私人资产。
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // 启用递归自查找
    if (name) {
      Sub.options.components[name] = Sub
    }

    // 在扩展时保留对 Super Options 的引用。
// 稍后在 instantiation 中，我们可以检查 Super 的选项是否具有
// 已更新。
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // 缓存生成器
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps(Comp: typeof Component) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed(Comp: typeof Component) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
