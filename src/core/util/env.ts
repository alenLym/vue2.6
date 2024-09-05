// 我们可以使用 __proto__ 吗？
export const hasProto = '__proto__' in {}

// 浏览器环境探查
export const inBrowser = typeof window !== 'undefined'
export const UA = inBrowser && window.navigator.userAgent.toLowerCase()
export const isIE = UA && /msie|trident/.test(UA)
export const isIE9 = UA && UA.indexOf('msie 9.0') > 0
export const isEdge = UA && UA.indexOf('edge/') > 0
export const isAndroid = UA && UA.indexOf('android') > 0
export const isIOS = UA && /iphone|ipad|ipod|ios/.test(UA)
export const isChrome = UA && /chrome\/\d+/.test(UA) && !isEdge
export const isPhantomJS = UA && /phantomjs/.test(UA)
export const isFF = UA && UA.match(/firefox\/(\d+)/)

// Firefox 在 Object.prototype 上有一个 “watch” 函数...
// @ts-expect-error firebox 支持
export const nativeWatch = {}.watch

export let supportsPassive = false
if (inBrowser) {
  try {
    const opts = {}
    Object.defineProperty(opts, 'passive', {
      get() {
        /* istanbul ignore next */
        supportsPassive = true
      }
    } as object) // https://github.com/facebook/flow/issues/285
    window.addEventListener('test-passive', null as any, opts)
  } catch (e: any) { }
}

// 这需要 lazy-evale，因为之前可能需要 Vue
// vue-server-renderer 可以设置 VUE_ENV
let _isServer
export const isServerRendering = () => {
  if (_isServer === undefined) {
    /* istanbul ignore if */
    if (!inBrowser && typeof global !== 'undefined') {
      // 检测 vue-server-renderer 的存在并避免
      // Webpack 填充进程
      _isServer =
        global['process'] && global['process'].env.VUE_ENV === 'server'
    } else {
      _isServer = false
    }
  }
  return _isServer
}

// 检测 DevTools
export const devtools = inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__

/* istanbul ignore next */
export function isNative(Ctor: any): boolean {
  return typeof Ctor === 'function' && /native code/.test(Ctor.toString())
}

export const hasSymbol =
  typeof Symbol !== 'undefined' &&
  isNative(Symbol) &&
  typeof Reflect !== 'undefined' &&
  isNative(Reflect.ownKeys)

let _Set // $flow-disable-line
/* istanbul ignore if */ if (typeof Set !== 'undefined' && isNative(Set)) {
  // 如果可用，请使用 native Set。
  _Set = Set
} else {
  // 一个非标准的 Set polyfill，仅适用于原始键。
  _Set = class Set implements SimpleSet {
    set: Record<string, boolean> = Object.create(null)

    has(key: string | number) {
      return this.set[key] === true
    }
    add(key: string | number) {
      this.set[key] = true
    }
    clear() {
      this.set = Object.create(null)
    }
  }
}

export interface SimpleSet {
  has(key: string | number): boolean
  add(key: string | number): any
  clear(): void
}

export { _Set }
