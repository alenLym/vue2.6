// 为单个元素/组件提供过渡支持。
// 支持过渡模式（Out-In / In-Out）

import { warn } from 'core/util/index'
import { camelize, extend, isPrimitive } from 'shared/util'
import {
  mergeVNodeHook,
  isAsyncPlaceholder,
  getFirstComponentChild
} from 'core/vdom/helpers/index'
import VNode from 'core/vdom/vnode'
import type { Component } from 'types/component'

export const transitionProps = {
  name: String,
  appear: Boolean,
  css: Boolean,
  mode: String,
  type: String,
  enterClass: String,
  leaveClass: String,
  enterToClass: String,
  leaveToClass: String,
  enterActiveClass: String,
  leaveActiveClass: String,
  appearClass: String,
  appearActiveClass: String,
  appearToClass: String,
  duration: [Number, String, Object]
}

// 如果 child 也是一个抽象组件，例如 <keep-alive>
// 我们想递归地检索要渲染的真实组件
function getRealChild(vnode?: VNode): VNode | undefined {
  const compOptions = vnode && vnode.componentOptions
  if (compOptions && compOptions.Ctor.options.abstract) {
    return getRealChild(getFirstComponentChild(compOptions.children))
  } else {
    return vnode
  }
}

export function extractTransitionData(comp: Component): Record<string, any> {
  const data = {}
  const options = comp.$options
  // props
  for (const key in options.propsData) {
    data[key] = comp[key]
  }
  // 事件。
// 提取侦听器并将其直接传递给 transition 方法
  const listeners = options._parentListeners
  for (const key in listeners) {
    data[camelize(key)] = listeners[key]
  }
  return data
}

function placeholder(h: Function, rawChild: VNode): VNode | undefined {
  // @ts-expect-error
  if (/\d-keep-alive$/.test(rawChild.tag)) {
    return h('keep-alive', {
      props: rawChild.componentOptions!.propsData
    })
  }
}

function hasParentTransition(vnode: VNode): boolean | undefined {
  while ((vnode = vnode.parent!)) {
    if (vnode.data!.transition) {
      return true
    }
  }
}

function isSameChild(child: VNode, oldChild: VNode): boolean {
  return oldChild.key === child.key && oldChild.tag === child.tag
}

const isNotTextNode = (c: VNode) => c.tag || isAsyncPlaceholder(c)

const isVShowDirective = d => d.name === 'show'

export default {
  name: 'transition',
  props: transitionProps,
  abstract: true,

  render(h: Function) {
    let children: any = this.$slots.default
    if (!children) {
      return
    }

    // 筛选出文本节点（可能的空格）
    children = children.filter(isNotTextNode)
    /* istanbul ignore if */
    if (!children.length) {
      return
    }

    // 警告多个元素
    if (__DEV__ && children.length > 1) {
      warn(
        '<transition> can only be used on a single element. Use ' +
          '<transition-group> for lists.',
        this.$parent
      )
    }

    const mode: string = this.mode

    // warn 无效模式
    if (__DEV__ && mode && mode !== 'in-out' && mode !== 'out-in') {
      warn('invalid <transition> mode: ' + mode, this.$parent)
    }

    const rawChild: VNode = children[0]

    // 如果这是组件根节点，并且组件的
// 父容器节点还具有 transition 和 skip。
    if (hasParentTransition(this.$vnode)) {
      return rawChild
    }

    // 将过渡数据应用于子项
// 使用 getRealChild（） 忽略抽象组件，例如 keep-alive
    const child = getRealChild(rawChild)
    /* istanbul ignore if */
    if (!child) {
      return rawChild
    }

    if (this._leaving) {
      return placeholder(h, rawChild)
    }

    // 确保 vnode 类型和此转换的键是唯一的
// component 实例。此键将用于删除待处理的离开节点
// 在进入期间。
    const id: string = `__transition-${this._uid}-`
    child.key =
      child.key == null
        ? child.isComment
          ? id + 'comment'
          : id + child.tag
        : isPrimitive(child.key)
        ? String(child.key).indexOf(id) === 0
          ? child.key
          : id + child.key
        : child.key

    const data: Object = ((child.data || (child.data = {})).transition =
      extractTransitionData(this))
    const oldRawChild: VNode = this._vnode
    const oldChild = getRealChild(oldRawChild)

    // Mark V-Show 展会
// 这样 transition 模块就可以将控制权交给 Directive
    if (child.data.directives && child.data.directives.some(isVShowDirective)) {
      child.data.show = true
    }

    if (
      oldChild &&
      oldChild.data &&
      !isSameChild(child, oldChild) &&
      !isAsyncPlaceholder(oldChild) &&
      // #6687 组件根是一个 comment 节点
      !(
        oldChild.componentInstance &&
        oldChild.componentInstance._vnode!.isComment
      )
    ) {
      // 将旧的子过渡数据替换为新的子过渡数据
// 对于动态过渡很重要！
      const oldData: Object = (oldChild.data.transition = extend({}, data))
      // 手柄过渡模式
      if (mode === 'out-in') {
        // 离开时返回占位符节点和队列更新
        this._leaving = true
        mergeVNodeHook(oldData, 'afterLeave', () => {
          this._leaving = false
          this.$forceUpdate()
        })
        return placeholder(h, rawChild)
      } else if (mode === 'in-out') {
        if (isAsyncPlaceholder(child)) {
          return oldRawChild
        }
        let delayedLeave
        const performLeave = () => {
          delayedLeave()
        }
        mergeVNodeHook(data, 'afterEnter', performLeave)
        mergeVNodeHook(data, 'enterCancelled', performLeave)
        mergeVNodeHook(oldData, 'delayLeave', leave => {
          delayedLeave = leave
        })
      }
    }

    return rawChild
  }
}
