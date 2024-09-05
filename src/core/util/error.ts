import config from '../config'
import { warn } from './debug'
import { inBrowser } from './env'
import { isPromise } from 'shared/util'
import { pushTarget, popTarget } from '../observer/dep'

export function handleError(err: Error, vm: any, info: string) {
  // 在处理错误处理程序时停用 deps tracking，以避免可能的无限渲染。
  // 另请： https://github.com/vuejs/vuex/issues/1505
  pushTarget()
  try {
    if (vm) {
      let cur = vm
      while ((cur = cur.$parent)) {
        const hooks = cur.$options.errorCaptured
        if (hooks) {
          for (let i = 0; i < hooks.length; i++) {
            try {
              const capture = hooks[i].call(cur, err, vm, info) === false
              if (capture) return
            } catch (e: any) {
              globalHandleError(e, cur, 'errorCaptured hook')
            }
          }
        }
      }
    }
    globalHandleError(err, vm, info)
  } finally {
    popTarget()
  }
}

export function invokeWithErrorHandling(
  handler: Function,
  context: any,
  args: null | any[],
  vm: any,
  info: string
) {
  let res
  try {
    res = args ? handler.apply(context, args) : handler.call(context)
    if (res && !res._isVue && isPromise(res) && !(res as any)._handled) {
      res.catch(e => handleError(e, vm, info + ` (Promise/async)`))
        // 问题 #9511
        // 避免在嵌套调用时多次触发 catch
        ; (res as any)._handled = true
    }
  } catch (e: any) {
    handleError(e, vm, info)
  }
  return res
}

function globalHandleError(err, vm, info) {
  if (config.errorHandler) {
    try {
      return config.errorHandler.call(null, err, vm, info)
    } catch (e: any) {
      // 如果用户有意在处理程序中抛出原始错误，
      // 不要记录两次
      if (e !== err) {
        logError(e, null, 'config.errorHandler')
      }
    }
  }
  logError(err, vm, info)
}

function logError(err, vm, info) {
  if (__DEV__) {
    warn(`Error in ${info}: "${err.toString()}"`, vm)
  }
  /* istanbul ignore else */
  if (inBrowser && typeof console !== 'undefined') {
    console.error(err)
  } else {
    throw err
  }
}
