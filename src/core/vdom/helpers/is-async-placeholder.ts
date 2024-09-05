import VNode from '../vnode'

export function isAsyncPlaceholder(node: VNode): boolean {
  // @ts-expect-error 不是真正的布尔类型
  return node.isComment && node.asyncFactory
}
