import type VNode from 'core/vdom/vnode'
import type Watcher from 'core/observer/watcher'
import { ComponentOptions } from './options'
import { SetupContext } from 'v3/apiSetup'
import { ScopedSlotsData, VNodeChildren, VNodeData } from './vnode'
import { GlobalAPI } from './global-api'
import { EffectScope } from 'v3/reactivity/effectScope'

// TODO this should be using the same as /component/

/**
 * @internal
 */
export declare class Component {
  constructor(options?: any)
  // 构造函数信息
  static cid: number
  static options: Record<string, any>
  // 扩展
  static extend: GlobalAPI['extend']
  static superOptions: Record<string, any>
  static extendOptions: Record<string, any>
  static sealedOptions: Record<string, any>
  static super: typeof Component
  // assets
  static directive: GlobalAPI['directive']
  static component: GlobalAPI['component']
  static filter: GlobalAPI['filter']
  // 函数上下文构造函数
  static FunctionalRenderContext: Function
  static mixin: GlobalAPI['mixin']
  static use: GlobalAPI['use']

  // 公共属性
  $el: any // 以便我们可以将 __vue__ 附加到它
  $data: Record<string, any>
  $props: Record<string, any>
  $options: ComponentOptions
  $parent: Component | undefined
  $root: Component
  $children: Array<Component>
  $refs: {
    [key: string]: Component | Element | Array<Component | Element> | undefined
  }
  $slots: { [key: string]: Array<VNode> }
  $scopedSlots: { [key: string]: () => VNode[] | undefined }
  $vnode: VNode // 父级渲染树中组件的占位符节点
  $attrs: { [key: string]: string }
  $listeners: Record<string, Function | Array<Function>>
  $isServer: boolean

  // 公共方法
  $mount: (
    el?: Element | string,
    hydrating?: boolean
  ) => Component & { [key: string]: any }
  $forceUpdate: () => void
  $destroy: () => void
  $set: <T>(
    target: Record<string, any> | Array<T>,
    key: string | number,
    val: T
  ) => T
  $delete: <T>(
    target: Record<string, any> | Array<T>,
    key: string | number
  ) => void
  $watch: (
    expOrFn: string | (() => any),
    cb: Function,
    options?: Record<string, any>
  ) => Function
  $on: (event: string | Array<string>, fn: Function) => Component
  $once: (event: string, fn: Function) => Component
  $off: (event?: string | Array<string>, fn?: Function) => Component
  $emit: (event: string, ...args: Array<any>) => Component
  $nextTick: (fn: (...args: any[]) => any) => void | Promise<any>
  $createElement: (
    tag?: string | Component,
    data?: Record<string, any>,
    children?: VNodeChildren
  ) => VNode

  // 私有属性
  _uid: number | string
  _name: string // 这仅存在于开发模式下
  _isVue: true
  __v_skip: true
  _self: Component
  _renderProxy: Component
  _renderContext?: Component
  _watcher: Watcher | null
  _scope: EffectScope
  _computedWatchers: { [key: string]: Watcher }
  _data: Record<string, any>
  _props: Record<string, any>
  _events: Record<string, any>
  _inactive: boolean | null
  _directInactive: boolean
  _isMounted: boolean
  _isDestroyed: boolean
  _isBeingDestroyed: boolean
  _vnode?: VNode | null // 自根节点
  _staticTrees?: Array<VNode> | null // v-once 缓存树
  _hasHookEvent: boolean
  _provided: Record<string, any>
  // _virtualComponents?: { [key: string]: Component };

  // @v3
  _setupState?: Record<string, any>
  _setupProxy?: Record<string, any>
  _setupContext?: SetupContext
  _attrsProxy?: Record<string, any>
  _listenersProxy?: Record<string, Function | Function[]>
  _slotsProxy?: Record<string, () => VNode[]>
  _preWatchers?: Watcher[]

  // 私有方法

  // 生命周期
  _init: Function
  _mount: (el?: Element | void, hydrating?: boolean) => Component
  _update: (vnode: VNode, hydrating?: boolean) => void

  // 渲染
  _render: () => VNode

  __patch__: (
    a: Element | VNode | void | null,
    b: VNode | null,
    hydrating?: boolean,
    removeOnly?: boolean,
    parentElm?: any,
    refElm?: any
  ) => any

  // Create 元素

  // _c 是接受 'normalizationType' 优化提示的内部
  _c: (
    vnode?: VNode,
    data?: VNodeData,
    children?: VNodeChildren,
    normalizationType?: number
  ) => VNode | void

  // 渲染静态
  _m: (index: number, isInFor?: boolean) => VNode | VNodeChildren
  // 标记一次
  _o: (
    vnode: VNode | Array<VNode>,
    index: number,
    key: string
  ) => VNode | VNodeChildren
  // 目标字符串
  _s: (value: any) => string
  // 文本到 VNode
  _v: (value: string | number) => VNode
  // 编号
  _n: (value: string) => number | string
  // 空 vnode
  _e: () => VNode
  // 松散等于
  _q: (a: any, b: any) => boolean
  // 松散的 indexOf
  _i: (arr: Array<any>, val: any) => number
  // 解决过滤器
  _f: (id: string) => Function
  // 渲染列表
  _l: (val: any, render: Function) => Array<VNode> | null
  // 渲染槽
  _t: (
    name: string,
    fallback?: Array<VNode>,
    props?: Record<string, any>
  ) => Array<VNode> | null
  // 应用 v-bind 对象
  _b: (
    data: any,
    tag: string,
    value: any,
    asProp: boolean,
    isSync?: boolean
  ) => VNodeData
  // 应用 V-On 对象
  _g: (data: any, value: any) => VNodeData
  // 检查自定义 keyCode
  _k: (
    eventKeyCode: number,
    key: string,
    builtInAlias?: number | Array<number>,
    eventKeyName?: string
  ) => boolean | null
  // 解析作用域插槽
  _u: (
    scopedSlots: ScopedSlotsData,
    res?: Record<string, any>
  ) => { [key: string]: Function }

  // SSR 特定
  _ssrNode: Function
  _ssrList: Function
  _ssrEscape: Function
  _ssrAttr: Function
  _ssrAttrs: Function
  _ssrDOMProps: Function
  _ssrClass: Function
  _ssrStyle: Function

  // 允许动态方法注册
// [key： string]： 任意
}
