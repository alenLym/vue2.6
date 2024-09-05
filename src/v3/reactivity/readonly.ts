import { def, warn, isPlainObject, isArray } from 'core/util'
import {
  isCollectionType,
  isReadonly,
  isShallow,
  ReactiveFlags,
  UnwrapNestedRefs
} from './reactive'
import { isRef, Ref, RefFlag } from './ref'

type Primitive = string | number | boolean | bigint | symbol | undefined | null
type Builtin = Primitive | Function | Date | Error | RegExp
export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends ReadonlyMap<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends Set<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends ReadonlySet<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends WeakSet<infer U>
  ? WeakSet<DeepReadonly<U>>
  : T extends Promise<infer U>
  ? Promise<DeepReadonly<U>>
  : T extends Ref<infer U>
  ? Readonly<Ref<DeepReadonly<U>>>
  : T extends {}
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : Readonly<T>

const rawToReadonlyFlag = `__v_rawToReadonly`
const rawToShallowReadonlyFlag = `__v_rawToShallowReadonly`

export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReadonly(target, false)
}

function createReadonly(target: any, shallow: boolean) {
  if (!isPlainObject(target)) {
    if (__DEV__) {
      if (isArray(target)) {
        warn(`Vue 2 does not support readonly arrays.`)
      } else if (isCollectionType(target)) {
        warn(
          `Vue 2 does not support readonly collection types such as Map or Set.`
        )
      } else {
        warn(`value cannot be made readonly: ${typeof target}`)
      }
    }
    return target as any
  }

  if (__DEV__ && !Object.isExtensible(target)) {
    warn(
      `Vue 2 does not support creating readonly proxy for non-extensible object.`
    )
  }

  // 已是 readonly 对象
  if (isReadonly(target)) {
    return target as any
  }

  // 已经有一个 readonly 代理
  const existingFlag = shallow ? rawToShallowReadonlyFlag : rawToReadonlyFlag
  const existingProxy = target[existingFlag]
  if (existingProxy) {
    return existingProxy
  }

  const proxy = Object.create(Object.getPrototypeOf(target))
  def(target, existingFlag, proxy)

  def(proxy, ReactiveFlags.IS_READONLY, true)
  def(proxy, ReactiveFlags.RAW, target)

  if (isRef(target)) {
    def(proxy, RefFlag, true)
  }
  if (shallow || isShallow(target)) {
    def(proxy, ReactiveFlags.IS_SHALLOW, true)
  }

  const keys = Object.keys(target)
  for (let i = 0; i < keys.length; i++) {
    defineReadonlyProperty(proxy, target, keys[i], shallow)
  }

  return proxy as any
}

function defineReadonlyProperty(
  proxy: any,
  target: any,
  key: string,
  shallow: boolean
) {
  Object.defineProperty(proxy, key, {
    enumerable: true,
    configurable: true,
    get() {
      const val = target[key]
      return shallow || !isPlainObject(val) ? val : readonly(val)
    },
    set() {
      __DEV__ &&
        warn(`Set operation on key "${key}" failed: target is readonly.`)
    }
  })
}

/**
 * 返回原始对象的响应式副本，其中只有根级属性是只读的，并且不解包引用，也不递归转换返回的属性。
 * 这用于为有状态组件创建 props 代理对象。
 */
export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReadonly(target, true)
}
