import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'
import type { GlobalAPI } from 'types/global-api'

export function initGlobalAPI(Vue: GlobalAPI) {
  // config
  const configDef: Record<string, any> = {}
  configDef.get = () => config
  if (__DEV__) {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }

  Object.defineProperty(Vue, 'config', configDef)

  // 暴露的 util 方法。
  // 注意：这些不被视为公共 API 的一部分 - 除非您意识到风险，否则请避免依赖它们。
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // Vue static
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 显式 observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // 这用于标识 “base” 构造函数以扩展所有 plain-object
  // 组件。
  Vue.options._base = Vue

  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
