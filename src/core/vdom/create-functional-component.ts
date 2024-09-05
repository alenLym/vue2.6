import VNode, { cloneVNode } from './vnode'
import { createElement } from './create-element'
import { resolveInject } from '../instance/inject'
import { normalizeChildren } from '../vdom/helpers/normalize-children'
import { resolveSlots } from '../instance/render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import { installRenderHelpers } from '../instance/render-helpers/index'

import {
  isDef,
  isTrue,
  hasOwn,
  isArray,
  camelize,
  emptyObject,
  validateProp
} from '../util/index'
import type { Component } from 'types/component'
import type { VNodeData } from 'types/vnode'

export function FunctionalRenderContext(
  data: VNodeData,
  props: Object,
  children: Array<VNode> | undefined,
  parent: Component,
  Ctor: typeof Component
) {
  const options = Ctor.options
  // 确保功能组件中的 createElement 函数
  // 获取唯一上下文 - 这对于正确的命名槽检查是必需的
  let contextVm
  if (hasOwn(parent, '_uid')) {
    contextVm = Object.create(parent)
    contextVm._original = parent
  } else {
    // 传入的上下文 VM 也是一个功能上下文。
    // 在这种情况下，我们希望确保能够保留
    // real context 实例。
    contextVm = parent
    // @ts-ignore
    parent = parent._original
  }
  const isCompiled = isTrue(options._compiled)
  const needNormalization = !isCompiled

  this.data = data
  this.props = props
  this.children = children
  this.parent = parent
  this.listeners = data.on || emptyObject
  this.injections = resolveInject(options.inject, parent)
  this.slots = () => {
    if (!this.$slots) {
      normalizeScopedSlots(
        parent,
        data.scopedSlots,
        (this.$slots = resolveSlots(children, parent))
      )
    }
    return this.$slots
  }

  Object.defineProperty(this, 'scopedSlots', {
    enumerable: true,
    get() {
      return normalizeScopedSlots(parent, data.scopedSlots, this.slots())
    }
  } as any)

  // 支持已编译的功能模板
  if (isCompiled) {
    // 为 renderStatic（） 公开 $options
    this.$options = options
    // renderSlot（） 的预解析槽
    this.$slots = this.slots()
    this.$scopedSlots = normalizeScopedSlots(
      parent,
      data.scopedSlots,
      this.$slots
    )
  }

  if (options._scopeId) {
    this._c = (a, b, c, d) => {
      const vnode = createElement(contextVm, a, b, c, d, needNormalization)
      if (vnode && !isArray(vnode)) {
        vnode.fnScopeId = options._scopeId
        vnode.fnContext = parent
      }
      return vnode
    }
  } else {
    this._c = (a, b, c, d) =>
      createElement(contextVm, a, b, c, d, needNormalization)
  }
}

installRenderHelpers(FunctionalRenderContext.prototype)

export function createFunctionalComponent(
  Ctor: typeof Component,
  propsData: Object | undefined,
  data: VNodeData,
  contextVm: Component,
  children?: Array<VNode>
): VNode | Array<VNode> | void {
  const options = Ctor.options
  const props = {}
  const propOptions = options.props
  if (isDef(propOptions)) {
    for (const key in propOptions) {
      props[key] = validateProp(key, propOptions, propsData || emptyObject)
    }
  } else {
    if (isDef(data.attrs)) mergeProps(props, data.attrs)
    if (isDef(data.props)) mergeProps(props, data.props)
  }

  const renderContext = new FunctionalRenderContext(
    data,
    props,
    children,
    contextVm,
    Ctor
  )

  const vnode = options.render.call(null, renderContext._c, renderContext)

  if (vnode instanceof VNode) {
    return cloneAndMarkFunctionalResult(
      vnode,
      data,
      renderContext.parent,
      options,
      renderContext
    )
  } else if (isArray(vnode)) {
    const vnodes = normalizeChildren(vnode) || []
    const res = new Array(vnodes.length)
    for (let i = 0; i < vnodes.length; i++) {
      res[i] = cloneAndMarkFunctionalResult(
        vnodes[i],
        data,
        renderContext.parent,
        options,
        renderContext
      )
    }
    return res
  }
}

function cloneAndMarkFunctionalResult(
  vnode,
  data,
  contextVm,
  options,
  renderContext
) {
  // #7817 在设置 fnContext 之前克隆节点，否则如果该节点被重用
  // （例如，它来自缓存的普通插槽）fnContext 导致命名插槽
  // 这不应该被匹配到 MATCH。
  const clone = cloneVNode(vnode)
  clone.fnContext = contextVm
  clone.fnOptions = options
  if (__DEV__) {
    ; (clone.devtoolsMeta = clone.devtoolsMeta || ({} as any)).renderContext =
      renderContext
  }
  if (data.slot) {
    ; (clone.data || (clone.data = {})).slot = data.slot
  }
  return clone
}

function mergeProps(to, from) {
  for (const key in from) {
    to[camelize(key)] = from[key]
  }
}
