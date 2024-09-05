import VNode, { createTextVNode } from 'core/vdom/vnode'
import {
  isFalse,
  isTrue,
  isArray,
  isDef,
  isUndef,
  isPrimitive
} from 'shared/util'

// 模板编译器尝试通过在编译时静态分析模板来最大程度地减少规范化的需求。
//
// 对于纯 HTML 标记，可以完全跳过规范化，因为生成的 render 函数保证返回 Array<VNode>。在两种情况下，需要额外的规范化：
// 1. 当子组件包含组件时 - 因为一个功能组件
// 可能返回一个 Array 而不是单个根。在这种情况下，只需一个简单的
// 需要规范化 - 如果任何 child 是 Array，我们将整个
// 与 Array.prototype.concat 一起使用。保证只有 1 层深
// 因为功能组件已经规范化了它们自己的子项。
export function simpleNormalizeChildren(children: any) {
  for (let i = 0; i < children.length; i++) {
    if (isArray(children[i])) {
      return Array.prototype.concat.apply([], children)
    }
  }
  return children
}

// 2. 当 children 包含始终生成嵌套 Array 的构造时，
// 例如<template>，、<slot>、v-for，或者当 children 由用户提供时
// 使用手写的渲染函数 / JSX。在这种情况下，完全规范化
// 需要满足所有可能的 children 值类型。
export function normalizeChildren(children: any): Array<VNode> | undefined {
  return isPrimitive(children)
    ? [createTextVNode(children)]
    : isArray(children)
      ? normalizeArrayChildren(children)
      : undefined
}

function isTextNode(node): boolean {
  return isDef(node) && isDef(node.text) && isFalse(node.isComment)
}

function normalizeArrayChildren(
  children: any,
  nestedIndex?: string
): Array<VNode> {
  const res: VNode[] = []
  let i, c, lastIndex, last
  for (i = 0; i < children.length; i++) {
    c = children[i]
    if (isUndef(c) || typeof c === 'boolean') continue
    lastIndex = res.length - 1
    last = res[lastIndex]
    //  嵌 套
    if (isArray(c)) {
      if (c.length > 0) {
        c = normalizeArrayChildren(c, `${nestedIndex || ''}_${i}`)
        // 合并相邻文本节点
        if (isTextNode(c[0]) && isTextNode(last)) {
          res[lastIndex] = createTextVNode(last.text + c[0].text)
          c.shift()
        }
        res.push.apply(res, c)
      }
    } else if (isPrimitive(c)) {
      if (isTextNode(last)) {
        // 合并相邻文本节点
        // 这对于 SSR 激活是必需的，因为文本节点是
        // 渲染为 HTML 字符串时基本上合并
        res[lastIndex] = createTextVNode(last.text + c)
      } else if (c !== '') {
        // 将基元转换为 vnode
        res.push(createTextVNode(c))
      }
    } else {
      if (isTextNode(c) && isTextNode(last)) {
        // 合并相邻文本节点
        res[lastIndex] = createTextVNode(last.text + c.text)
      } else {
        // 嵌套数组子项的默认键（可能由 v-for 生成）
        if (
          isTrue(children._isVList) &&
          isDef(c.tag) &&
          isUndef(c.key) &&
          isDef(nestedIndex)
        ) {
          c.key = `__vlist${nestedIndex}_${i}__`
        }
        res.push(c)
      }
    }
  }
  return res
}
