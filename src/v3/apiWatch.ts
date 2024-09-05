import { isRef, Ref } from './reactivity/ref'
import { ComputedRef } from './reactivity/computed'
import { isReactive, isShallow } from './reactivity/reactive'
import {
  warn,
  noop,
  isArray,
  isFunction,
  emptyObject,
  hasChanged,
  isServerRendering,
  invokeWithErrorHandling
} from 'core/util'
import { currentInstance } from './currentInstance'
import { traverse } from 'core/observer/traverse'
import Watcher from '../core/observer/watcher'
import { queueWatcher } from '../core/observer/scheduler'
import { DebuggerOptions } from './debug'

const WATCHER = `watcher`
const WATCHER_CB = `${WATCHER} callback`
const WATCHER_GETTER = `${WATCHER} getter`
const WATCHER_CLEANUP = `${WATCHER} cleanup`

export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup
) => any

type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? Immediate extends true
      ? V | undefined
      : V
    : T[K] extends object
    ? Immediate extends true
      ? T[K] | undefined
      : T[K]
    : never
}

type OnCleanup = (cleanupFn: () => void) => void

export interface WatchOptionsBase extends DebuggerOptions {
  flush?: 'pre' | 'post' | 'sync'
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate
  deep?: boolean
}

export type WatchStopHandle = () => void

// 简单效果。
export function watchEffect(
  effect: WatchEffect,
  options?: WatchOptionsBase
): WatchStopHandle {
  return doWatch(effect, null, options)
}

export function watchPostEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
) {
  return doWatch(
    effect,
    null,
    (__DEV__
      ? { ...options, flush: 'post' }
      : { flush: 'post' }) as WatchOptionsBase
  )
}

export function watchSyncEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
) {
  return doWatch(
    effect,
    null,
    (__DEV__
      ? { ...options, flush: 'sync' }
      : { flush: 'sync' }) as WatchOptionsBase
  )
}

// 初始值，供观察程序在未定义的初始值上触发
const INITIAL_WATCHER_VALUE = {}

type MultiWatchSources = (WatchSource<unknown> | object)[]

// 重载：多个源的数组 + CB
export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// 过载：多个源 w/ 'as const'
// watch（[foo， bar] as const， （） => {}）
// 不知何故 [......T] 在类型为 readonly 时中断
export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// 过载：单源 + CB
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// 过载：使用 cb 监视响应式对象
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// 实现
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>
): WatchStopHandle {
  if (__DEV__ && typeof cb !== 'function') {
    warn(
      `\`watch(fn, options?)\` signature has been moved to a separate API. ` +
        `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
        `supports \`watch(source, cb, options?) signature.`
    )
  }
  return doWatch(source as any, cb, options)
}

function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  {
    immediate,
    deep,
    flush = 'pre',
    onTrack,
    onTrigger
  }: WatchOptions = emptyObject
): WatchStopHandle {
  if (__DEV__ && !cb) {
    if (immediate !== undefined) {
      warn(
        `watch() "immediate" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }
    if (deep !== undefined) {
      warn(
        `watch() "deep" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }
  }

  const warnInvalidSource = (s: unknown) => {
    warn(
      `Invalid watch source: ${s}. A watch source can only be a getter/effect ` +
        `function, a ref, a reactive object, or an array of these types.`
    )
  }

  const instance = currentInstance
  const call = (fn: Function, type: string, args: any[] | null = null) => {
    const res = invokeWithErrorHandling(fn, null, args, instance, type)
    if (deep && res && res.__ob__) res.__ob__.dep.depend()
    return res
  }

  let getter: () => any
  let forceTrigger = false
  let isMultiSource = false

  if (isRef(source)) {
    getter = () => source.value
    forceTrigger = isShallow(source)
  } else if (isReactive(source)) {
    getter = () => {
      ;(source as any).__ob__.dep.depend()
      return source
    }
    deep = true
  } else if (isArray(source)) {
    isMultiSource = true
    forceTrigger = source.some(s => isReactive(s) || isShallow(s))
    getter = () =>
      source.map(s => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          s.__ob__.dep.depend()
          return traverse(s)
        } else if (isFunction(s)) {
          return call(s, WATCHER_GETTER)
        } else {
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    if (cb) {
      // 带 CB 的 Getter
      getter = () => call(source, WATCHER_GETTER)
    } else {
      // 无 CB -> 简单效果
      getter = () => {
        if (instance && instance._isDestroyed) {
          return
        }
        if (cleanup) {
          cleanup()
        }
        return call(source, WATCHER, [onCleanup])
      }
    }
  } else {
    getter = noop
    __DEV__ && warnInvalidSource(source)
  }

  if (cb && deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: () => void
  let onCleanup: OnCleanup = (fn: () => void) => {
    cleanup = watcher.onStop = () => {
      call(fn, WATCHER_CLEANUP)
    }
  }

  // 在 SSR 中不需要设置实际效果，应该是 noop
// 除非它很渴望
  if (isServerRendering()) {
    // 我们也不会调用 Invalidate 回调（+ 未设置 runner）
    onCleanup = noop
    if (!cb) {
      getter()
    } else if (immediate) {
      call(cb, WATCHER_CB, [
        getter(),
        isMultiSource ? [] : undefined,
        onCleanup
      ])
    }
    return noop
  }

  const watcher = new Watcher(currentInstance, getter, noop, {
    lazy: true
  })
  watcher.noRecurse = !cb

  let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE
  // 覆盖默认运行
  watcher.run = () => {
    if (!watcher.active) {
      return
    }
    if (cb) {
      // watch(source, cb)
      const newValue = watcher.get()
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) =>
              hasChanged(v, (oldValue as any[])[i])
            )
          : hasChanged(newValue, oldValue))
      ) {
        // 再次运行 CB 之前的清理
        if (cleanup) {
          cleanup()
        }
        call(cb, WATCHER_CB, [
          newValue,
          // 首次更改时，将 undefined 作为旧值传递
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onCleanup
        ])
        oldValue = newValue
      }
    } else {
      // 手表效果
      watcher.get()
    }
  }

  if (flush === 'sync') {
    watcher.update = watcher.run
  } else if (flush === 'post') {
    watcher.post = true
    watcher.update = () => queueWatcher(watcher)
  } else {
    // pre
    watcher.update = () => {
      if (instance && instance === currentInstance && !instance._isMounted) {
        // pre-watcher 触发前
        const buffer = instance._preWatchers || (instance._preWatchers = [])
        if (buffer.indexOf(watcher) < 0) buffer.push(watcher)
      } else {
        queueWatcher(watcher)
      }
    }
  }

  if (__DEV__) {
    watcher.onTrack = onTrack
    watcher.onTrigger = onTrigger
  }

  // 初始运行
  if (cb) {
    if (immediate) {
      watcher.run()
    } else {
      oldValue = watcher.get()
    }
  } else if (flush === 'post' && instance) {
    instance.$once('hook:mounted', () => watcher.get())
  } else {
    watcher.get()
  }

  return () => {
    watcher.teardown()
  }
}
