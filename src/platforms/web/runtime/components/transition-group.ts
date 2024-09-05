// 为列表项提供过渡支持。
// 支持使用 FLIP 技术移动过渡。
// 因为 vdom 的 children 更新算法是“不稳定的”——即
// 它不保证已删除元素的相对位置，
// 我们强制 transition-group 将其子节点更新为两个过程：
// 在第一遍中，我们删除所有需要删除的节点，
// 触发他们的离开过渡;在第二个通道中，我们插入/移动
// 进入最终所需状态。这样在第二次传递中删除
// 节点将保留在它们应该位于的位置。

import { warn, extend } from 'core/util/index'
import { addClass, removeClass } from 'web/runtime/class-util'
import { transitionProps, extractTransitionData } from './transition'
import { setActiveInstance } from 'core/instance/lifecycle'

import {
  hasTransition,
  getTransitionInfo,
  transitionEndEvent,
  addTransitionClass,
  removeTransitionClass
} from 'web/runtime/transition-util'
import VNode from 'core/vdom/vnode'
import { VNodeWithData } from 'types/vnode'
import { getComponentName } from 'core/vdom/create-component'

const props = extend(
  {
    tag: String,
    moveClass: String
  },
  transitionProps
)

delete props.mode

export default {
  props,

  beforeMount() {
    const update = this._update
    this._update = (vnode, hydrating) => {
      const restoreActiveInstance = setActiveInstance(this)
      // 强制删除路径
      this.__patch__(
        this._vnode,
        this.kept,
        false, // hydrating
        true // removeOnly （！important，避免不必要的移动）
      )
      this._vnode = this.kept
      restoreActiveInstance()
      update.call(this, vnode, hydrating)
    }
  },

  render(h: Function) {
    const tag: string = this.tag || this.$vnode.data.tag || 'span'
    const map: Record<string, any> = Object.create(null)
    const prevChildren: Array<VNode> = (this.prevChildren = this.children)
    const rawChildren: Array<VNode> = this.$slots.default || []
    const children: Array<VNode> = (this.children = [])
    const transitionData = extractTransitionData(this)

    for (let i = 0; i < rawChildren.length; i++) {
      const c: VNode = rawChildren[i]
      if (c.tag) {
        if (c.key != null && String(c.key).indexOf('__vlist') !== 0) {
          children.push(c)
          map[c.key] = c
          ;(c.data || (c.data = {})).transition = transitionData
        } else if (__DEV__) {
          const opts = c.componentOptions
          const name: string = opts
            ? getComponentName(opts.Ctor.options as any) || opts.tag || ''
            : c.tag
          warn(`<transition-group> children must be keyed: <${name}>`)
        }
      }
    }

    if (prevChildren) {
      const kept: Array<VNode> = []
      const removed: Array<VNode> = []
      for (let i = 0; i < prevChildren.length; i++) {
        const c: VNode = prevChildren[i]
        c.data!.transition = transitionData
        // @ts-expect-error .getBoundingClientRect 未在 Node 中键入
        c.data!.pos = c.elm.getBoundingClientRect()
        if (map[c.key!]) {
          kept.push(c)
        } else {
          removed.push(c)
        }
      }
      this.kept = h(tag, null, kept)
      this.removed = removed
    }

    return h(tag, null, children)
  },

  updated() {
    const children: Array<VNodeWithData> = this.prevChildren
    const moveClass: string = this.moveClass || (this.name || 'v') + '-move'
    if (!children.length || !this.hasMove(children[0].elm, moveClass)) {
      return
    }

    // 我们将工作分为三个循环，以避免混合 DOM 读取和写入
// 在每次迭代中 - 这有助于防止布局抖动。
    children.forEach(callPendingCbs)
    children.forEach(recordPosition)
    children.forEach(applyTranslation)

    // 强制回流焊以将所有内容都放到适当的位置
// assign to this 以避免在 tree-shaking 中删除
// $flow禁用行
    this._reflow = document.body.offsetHeight

    children.forEach((c: VNode) => {
      if (c.data!.moved) {
        const el: any = c.elm
        const s: any = el.style
        addTransitionClass(el, moveClass)
        s.transform = s.WebkitTransform = s.transitionDuration = ''
        el.addEventListener(
          transitionEndEvent,
          (el._moveCb = function cb(e) {
            if (e && e.target !== el) {
              return
            }
            if (!e || /transform$/.test(e.propertyName)) {
              el.removeEventListener(transitionEndEvent, cb)
              el._moveCb = null
              removeTransitionClass(el, moveClass)
            }
          })
        )
      }
    })
  },

  methods: {
    hasMove(el: any, moveClass: string): boolean {
      /* istanbul ignore if */
      if (!hasTransition) {
        return false
      }
      /* istanbul ignore if */
      if (this._hasMove) {
        return this._hasMove
      }
      // 检测应用了 move 类的元素是否具有
// CSS 过渡。由于该元素此时可能位于进入的过渡内，因此我们克隆它并删除所有其他应用的过渡类，以确保仅应用 move 类。
      const clone: HTMLElement = el.cloneNode()
      if (el._transitionClasses) {
        el._transitionClasses.forEach((cls: string) => {
          removeClass(clone, cls)
        })
      }
      addClass(clone, moveClass)
      clone.style.display = 'none'
      this.$el.appendChild(clone)
      const info: any = getTransitionInfo(clone)
      this.$el.removeChild(clone)
      return (this._hasMove = info.hasTransform)
    }
  }
}

function callPendingCbs(
  c: VNodeWithData & { elm?: { _moveCb?: Function; _enterCb?: Function } }
) {
  /* istanbul ignore if */
  if (c.elm!._moveCb) {
    c.elm!._moveCb()
  }
  /* istanbul ignore if */
  if (c.elm!._enterCb) {
    c.elm!._enterCb()
  }
}

function recordPosition(c: VNodeWithData) {
  c.data!.newPos = c.elm.getBoundingClientRect()
}

function applyTranslation(c: VNodeWithData) {
  const oldPos = c.data.pos
  const newPos = c.data.newPos
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    c.data.moved = true
    const s = c.elm.style
    s.transform = s.WebkitTransform = `translate(${dx}px,${dy}px)`
    s.transitionDuration = '0s'
  }
}
