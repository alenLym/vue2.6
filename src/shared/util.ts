export const emptyObject: Record<string, any> = Object.freeze({})

export const isArray = Array.isArray

// 由于它们的显式和函数内联，这些帮助程序可以在 JS 引擎中生成更好的 VM 代码。
export function isUndef(v: any): v is undefined | null {
  return v === undefined || v === null
}

export function isDef<T>(v: T): v is NonNullable<T> {
  return v !== undefined && v !== null
}

export function isTrue(v: any): boolean {
  return v === true
}

export function isFalse(v: any): boolean {
  return v === false
}

/**
 * 检查 value 是否为 primitive。
 */
export function isPrimitive(value: any): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    // $flow-disable-line
    typeof value === 'symbol' ||
    typeof value === 'boolean'
  )
}

export function isFunction(value: any): value is (...args: any[]) => any {
  return typeof value === 'function'
}

/**
 * 快速对象检查 - 当我们知道对象是符合 JSON 的类型时，这主要用于区分对象和原始值。
 */
export function isObject(obj: any): boolean {
  return obj !== null && typeof obj === 'object'
}

/**
 * 获取值的原始类型字符串，例如 [object Object]。
 */
const _toString = Object.prototype.toString

export function toRawType(value: any): string {
  return _toString.call(value).slice(8, -1)
}

/**
 * 严格的对象类型检查。仅对纯 JavaScript 对象返回 true。
 */
export function isPlainObject(obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}

export function isRegExp(v: any): v is RegExp {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * 检查 val 是否为有效的数组索引。
 */
export function isValidArrayIndex(val: any): boolean {
  const n = parseFloat(String(val))
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

export function isPromise(val: any): val is Promise<any> {
  return (
    isDef(val) &&
    typeof val.then === 'function' &&
    typeof val.catch === 'function'
  )
}

/**
 * 将值转换为实际呈现的字符串。
 */
export function toString(val: any): string {
  return val == null
    ? ''
    : Array.isArray(val) || (isPlainObject(val) && val.toString === _toString)
    ? JSON.stringify(val, replacer, 2)
    : String(val)
}

function replacer(_key: string, val: any): any {
  // 避免 v3 中的循环 deps
  if (val && val.__v_isRef) {
    return val.value
  }
  return val
}

/**
 * 将输入值转换为数字以实现持久性。
 * 如果转换失败，则返回原始字符串。
 */
export function toNumber(val: string): number | string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

/**
 * 创建一个 map 并返回一个函数，用于检查该 map 中是否有键。
 */
export function makeMap(
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | undefined {
  const map = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase ? val => map[val.toLowerCase()] : val => map[val]
}

/**
 * 检查标签是否为内置标签。
 */
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * 检查属性是否为保留属性。
 */
export const isReservedAttribute = makeMap('key,ref,slot,slot-scope,is')

/**
 * 从数组中删除项。
 */
export function remove(arr: Array<any>, item: any): Array<any> | void {
  const len = arr.length
  if (len) {
    // 唯一/最后一项的快速路径
    if (item === arr[len - 1]) {
      arr.length = len - 1
      return
    }
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

/**
 * 检查对象是否具有该属性。
 */
const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn(obj: Object | Array<any>, key: string): boolean {
  return hasOwnProperty.call(obj, key)
}

/**
 * 创建纯函数的缓存版本。
 */
export function cached<R>(fn: (str: string) => R): (sr: string) => R {
  const cache: Record<string, R> = Object.create(null)
  return function cachedFn(str: string) {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }
}

/**
 * 驼峰化一个以连字符分隔的字符串。
 */
const camelizeRE = /-(\w)/g
export const camelize = cached((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
})

/**
 * 将字符串大写。
 */
export const capitalize = cached((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * 对 camelCase 字符串进行连字符连接。
 */
const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cached((str: string): string => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})

/**
 * 对于不支持它的环境，例如 PhantomJS 1.x，简单绑定 polyfill。从技术上讲，我们不再需要它，因为原生绑定现在在大多数浏览器中的性能已经足够了。
 * 但删除它意味着破坏能够在
 * PhantomJS 1.x，因此必须保留此版本以实现向后兼容性。
 */
/* Istanbul 忽略下一个*/
function polyfillBind(fn: Function, ctx: Object): Function {
  function boundFn(a: any) {
    const l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }

  boundFn._length = fn.length
  return boundFn
}

function nativeBind(fn: Function, ctx: Object): Function {
  return fn.bind(ctx)
}

// @ts-expect-error 绑定不能为 'undefined'
export const bind = Function.prototype.bind ? nativeBind : polyfillBind

/**
 * 将类似 Array 的对象转换为真正的 Array。
 */
export function toArray(list: any, start?: number): Array<any> {
  start = start || 0
  let i = list.length - start
  const ret: Array<any> = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

/**
 * 将属性混合到目标对象中。
 */
export function extend(
  to: Record<PropertyKey, any>,
  _from?: Record<PropertyKey, any>
): Record<PropertyKey, any> {
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

/**
 * 将 Object 数组合并为单个 Object。
 */
export function toObject(arr: Array<any>): object {
  const res = {}
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i])
    }
  }
  return res
}

/* eslint-disable no-unused-vars*/
/**
 * 不执行任何操作。
 * Stubing args 以使 Flow 满意，而不会留下无用的转译代码 ...rest （https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/） 的
 */
export function noop(a?: any, b?: any, c?: any) {}

/**
 * 始终返回 false。
 */
export const no = (a?: any, b?: any, c?: any) => false

/* eslint-enable no-unused-vars*/
/**
 * 返回相同的值。
 */
export const identity = (_: any) => _

/**
 * 从编译器模块生成包含静态键的字符串。
 */
export function genStaticKeys(
  modules: Array<{ staticKeys?: string[] } /* ModuleOptions */>
): string {
  return modules
    .reduce<string[]>((keys, m) => keys.concat(m.staticKeys || []), [])
    .join(',')
}

/**
 * 检查两个值是否松散相等 - 也就是说，如果它们是普通对象，它们是否具有相同的形状？
 */
export function looseEqual(a: any, b: any): boolean {
  if (a === b) return true
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)
  if (isObjectA && isObjectB) {
    try {
      const isArrayA = Array.isArray(a)
      const isArrayB = Array.isArray(b)
      if (isArrayA && isArrayB) {
        return (
          a.length === b.length &&
          a.every((e: any, i: any) => {
            return looseEqual(e, b[i])
          })
        )
      } else if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime()
      } else if (!isArrayA && !isArrayB) {
        const keysA = Object.keys(a)
        const keysB = Object.keys(b)
        return (
          keysA.length === keysB.length &&
          keysA.every(key => {
            return looseEqual(a[key], b[key])
          })
        )
      } else {
        /* istanbul ignore next */
        return false
      }
    } catch (e: any) {
      /* istanbul ignore next */
      return false
    }
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

/**
 * 返回可以在数组中找到松散相等值的第一个索引（如果 value 是普通对象，则数组必须包含相同形状的对象），如果不存在，则返回 -1。
 */
export function looseIndexOf(arr: Array<unknown>, val: unknown): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

/**
 * 确保函数只调用一次。
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  return function () {
    if (!called) {
      called = true
      fn.apply(this, arguments as any)
    }
  } as any
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is#polyfill
export function hasChanged(x: unknown, y: unknown): boolean {
  if (x === y) {
    return x === 0 && 1 / x !== 1 / (y as number)
  } else {
    return x === x || y === y
  }
}
