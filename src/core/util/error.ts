import config from '../config'
import { warn } from './debug'
import { inBrowser } from './env'
import { isPromise } from 'shared/util'
import { pushTarget, popTarget } from '../observer/dep'
// 停用依赖追踪避免无限渲染。
// 如果存在vm，则遍历其父组件并调用每个父组件的errorCaptured钩子（若存在）。
// 若有任意一个钩子返回false，则停止错误传播。
// 若所有钩子执行完毕或未捕获，则进行全局错误处理。
// 整个过程确保在最后恢复依赖追踪状态。
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
// 尝试执行handler函数，并将结果存入res。
// 如果res是Promise且未被处理，则捕获可能的错误，并标记为已处理以避免重复触发。
// 捕捉执行过程中抛出的异常，并调用handleError进行处理。
// 返回执行结果res。
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
// 检查是否存在自定义错误处理器，若有，则调用之；若处理器中抛出新错误且新错误与原错误不同，则记录新错误。
// 若无自定义处理器或自定义处理器中未处理错误，则直接记录错误。
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
// 如果在开发模式下，使用warn函数显示错误详情，包括错误类型和发生位置。
// 如果在浏览器环境中且存在console对象，则将错误输出到控制台。
// 否则，抛出错误。
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
