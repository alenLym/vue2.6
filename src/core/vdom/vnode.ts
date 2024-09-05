import type { Component } from 'types/component'
import type { ComponentOptions } from 'types/options'
import type { VNodeComponentOptions, VNodeData } from 'types/vnode'

/**
 * @internal
 */
export default class VNode {
  tag?: string
  data: VNodeData | undefined
  children?: Array<VNode> | null
  text?: string
  elm: Node | undefined
  ns?: string
  context?: Component // 在此组件的范围内渲染
  key: string | number | undefined
  componentOptions?: VNodeComponentOptions
  componentInstance?: Component // 组件实例
  parent: VNode | undefined | null // Component Placeholder 节点

  // 严格内部
  raw: boolean // 包含原始 HTML？（仅限服务器）
  isStatic: boolean // 提升的静态节点
  isRootInsert: boolean // 进入过渡检查所必需的
  isComment: boolean // 空的评论占位符？
  isCloned: boolean // 是克隆节点吗？
  isOnce: boolean // is a v-once node?
  asyncFactory?: Function // 异步组件工厂函数
  asyncMeta: Object | void
  isAsyncPlaceholder: boolean
  ssrContext?: Object | void
  fnContext: Component | void // 功能节点的真实上下文 VM
  fnOptions?: ComponentOptions | null // 用于 SSR 缓存
  devtoolsMeta?: Object | null // 用于存储 DevTools 的函数式渲染上下文
  fnScopeId?: string | null // 功能范围 ID 支持
  isComponentRootElement?: boolean | null // 用于 SSR 指令

  constructor(
    tag?: string,
    data?: VNodeData,
    children?: Array<VNode> | null,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED： 用于向后兼容的 componentInstance 别名。
  /* istanbul ignore next */
  get child(): Component | void {
    return this.componentInstance
  }
}

export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

export function createTextVNode(val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// 优化的浅层克隆
// 用于静态节点和槽节点，因为它们可以在
// 多个渲染，克隆它们可以避免在 DOM 操作依赖
// 在他们的 ELM 参考中。
export function cloneVNode(vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
// clone children 数组以避免在克隆时改变 original
// 一个孩子。
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  cloned.isCloned = true
  return cloned
}
