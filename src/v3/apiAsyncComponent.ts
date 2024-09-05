import { warn, isFunction, isObject } from 'core/util'

interface AsyncComponentOptions {
  loader: Function
  loadingComponent?: any
  errorComponent?: any
  delay?: number
  timeout?: number
  suspensible?: boolean
  onError?: (
    error: Error,
    retry: () => void,
    fail: () => void,
    attempts: number
  ) => any
}

type AsyncComponentFactory = () => {
  component: Promise<any>
  loading?: any
  error?: any
  delay?: number
  timeout?: number
}

/**
 * 兼容 v3 的异步组件 API。
 * @internal类型是在 <root>/types/v3-define-async-component.d.ts 中手动声明的
 * 因为它依赖于现有的手动类型
 */
export function defineAsyncComponent(
  source: (() => any) | AsyncComponentOptions
): AsyncComponentFactory {
  if (isFunction(source)) {
    source = { loader: source } as AsyncComponentOptions
  }

  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout, // undefined = never times out
    suspensible = false, // 在 Vue 3 中，default 为 true
    onError: userOnError
  } = source

  if (__DEV__ && suspensible) {
    warn(
      `The suspensible option for async components is not supported in Vue2. It is ignored.`
    )
  }

  let pendingRequest: Promise<any> | null = null

  let retries = 0
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }

  const load = (): Promise<any> => {
    let thisRequest: Promise<any>
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch(err => {
            err = err instanceof Error ? err : new Error(String(err))
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry())
                const userFail = () => reject(err)
                userOnError(err, userRetry, userFail, retries + 1)
              })
            } else {
              throw err
            }
          })
          .then((comp: any) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest
            }
            if (__DEV__ && !comp) {
              warn(
                `Async component loader resolved to undefined. ` +
                  `If you are using retry(), make sure to return its return value.`
              )
            }
            // 互操作模块默认值
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
            ) {
              comp = comp.default
            }
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`)
            }
            return comp
          }))
    )
  }

  return () => {
    const component = load()

    return {
      component,
      delay,
      timeout,
      error: errorComponent,
      loading: loadingComponent
    }
  }
}
