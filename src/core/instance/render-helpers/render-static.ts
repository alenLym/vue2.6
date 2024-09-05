import VNode from 'core/vdom/vnode'
import { isArray } from 'core/util'

/**
 * 用于渲染静态树的运行时帮助程序。
 */
export function renderStatic(
  index: number,
  isInFor: boolean
): VNode | Array<VNode> {
  const cached = this._staticTrees || (this._staticTrees = [])
  let tree = cached[index]
  // 如果已经渲染了静态树，而不是在 v-for 中，
// 我们可以重用同一棵树。
  if (tree && !isInFor) {
    return tree
  }
  // 否则，渲染一棵新鲜的树。
  tree = cached[index] = this.$options.staticRenderFns[index].call(
    this._renderProxy,
    this._c,
    this // 对于为功能组件模板生成的渲染 FNS
  )
  markStatic(tree, `__static__${index}`, false)
  return tree
}

/**
 * v-once 的运行时帮助程序。
 * 实际上，这意味着使用唯一键将节点标记为 static。
 */
export function markOnce(
  tree: VNode | Array<VNode>,
  index: number,
  key: string
) {
  markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
  return tree
}

function markStatic(tree: VNode | Array<VNode>, key: string, isOnce: boolean) {
  if (isArray(tree)) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  } else {
    markStaticNode(tree, key, isOnce)
  }
}

function markStaticNode(node, key, isOnce) {
  node.isStatic = true
  node.key = key
  node.isOnce = isOnce
}
