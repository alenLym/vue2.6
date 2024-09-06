/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'

let initProxy

if (__DEV__) {
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
      'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
      'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,' +
      'require' // for Webpack/Browserify
  )

  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
        'referenced during render. Make sure that this property is reactive, ' +
        'either in the data option, or for class-based components, by ' +
        'initializing the property. ' +
        'See: https://v2.vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }

  const warnReservedPrefix = (target, key) => {
    warn(
      `Property "${key}" must be accessed with "$data.${key}" because ` +
        'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
        'prevent conflicts with Vue internals. ' +
        'See: https://v2.vuejs.org/v2/api/#data',
      target
    )
  }

  const hasProxy = typeof Proxy !== 'undefined' && isNative(Proxy)

  if (hasProxy) {
    const isBuiltInModifier = makeMap(
      'stop,prevent,self,ctrl,shift,alt,meta,exact'
    )
    config.keyCodes = new Proxy(config.keyCodes, {
      set(target, key: string, value) {
        if (isBuiltInModifier(key)) {
          warn(
            `Avoid overwriting built-in modifier in config.keyCodes: .${key}`
          )
          return false
        } else {
          target[key] = value
          return true
        }
      }
    })
  }
  // 首先检查 key 是否在 target 中。
  // 判断 key 是否属于允许的全局变量或以 _ 开头且不在 target.$data 中。
  // 如果 key 不在 target 中且不属于允许的情况，则根据 key 是否存在于 target.$data 发出不同警告。
  // 最后返回 key 是否在 target 中或不属于允许的情况。
  const hasHandler = {
    has(target, key) {
      const has = key in target
      const isAllowed =
        allowedGlobals(key) ||
        (typeof key === 'string' &&
          key.charAt(0) === '_' &&
          !(key in target.$data))
      if (!has && !isAllowed) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return has || !isAllowed
    }
  }
  // 当通过字符串键 key 访问目标对象 target 时，若 key 不是 target 的属性，则检查 target.$data 中是否存在该键。
  // 若 key 在 target.$data 中存在，则发出警告提示前缀被保留；否则，提示键未出现。
  // 最后返回 target[key] 的值。
  const getHandler = {
    get(target, key) {
      if (typeof key === 'string' && !(key in target)) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return target[key]
    }
  }
  // 检查是否存在 Proxy 支持。
  // 如果支持 Proxy：
  // 获取 Vue 实例的选项 ($options)。
  // 根据选项中的 render 方法确定使用哪种代理处理器。
  // 创建一个新的 Proxy 对象，将 vm 作为目标对象，并使用选定的处理器。
  // 如果不支持 Proxy，直接将 _renderProxy 设置为 vm 本身。
  initProxy = function initProxy(vm) {
    if (hasProxy) {
      // 确定要使用的代理处理程序
      const options = vm.$options
      const handlers =
        options.render && options.render._withStripped ? getHandler : hasHandler
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
