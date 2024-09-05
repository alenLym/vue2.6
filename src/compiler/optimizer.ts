import { makeMap, isBuiltInTag, cached, no } from 'shared/util'
import { ASTElement, CompilerOptions, ASTNode } from 'types/compiler'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * 优化器的目标：遍历生成的模板 AST 树并检测纯静态的子树，即 DOM 中永远不需要更改的部分。
 *
 * 一旦我们检测到这些子树，我们就可以：
 *
 * 1. 将它们提升为 constants，这样我们就不再需要
 *    在每次重新渲染时为它们创建新的节点;
 * 2. 在修补过程中完全跳过它们。
 */
export function optimize(
  root: ASTElement | null | undefined,
  options: CompilerOptions
) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // First Pass：标记所有非静态节点。
  markStatic(root)
  // 第二遍：标记静态根。
  markStaticRoots(root, false)
}

function genStaticKeys(keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
      (keys ? ',' + keys : '')
  )
}

function markStatic(node: ASTNode) {
  node.static = isStatic(node)
  if (node.type === 1) {
    // 不要将组件插槽内容设为静态。这避免了
// 1. 组件无法更改 slot 节点
// 2. 静态插槽内容热重载失败
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        node.static = false
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}

function markStaticRoots(node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // 要使节点符合静态根的条件，它应具有不仅仅是静态文本的子项。否则，吊装的成本将超过收益，最好总是让它焕然一新。
    if (
      node.static &&
      node.children.length &&
      !(node.children.length === 1 && node.children[0].type === 3)
    ) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

function isStatic(node: ASTNode): boolean {
  if (node.type === 2) {
    // 表达
    return false
  }
  if (node.type === 3) {
    // text
    return true
  }
  return !!(
    node.pre ||
    (!node.hasBindings && // 无动态绑定
      !node.if &&
      !node.for && // not v-if or v-for or v-else
      !isBuiltInTag(node.tag) && // not a built-in
      isPlatformReservedTag(node.tag) && // 不是组件
      !isDirectChildOfTemplateFor(node) &&
      Object.keys(node).every(isStaticKey))
  )
}

function isDirectChildOfTemplateFor(node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
