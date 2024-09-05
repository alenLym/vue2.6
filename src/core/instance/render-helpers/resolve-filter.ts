import { identity, resolveAsset } from 'core/util/index'

/**
 * 用于解析筛选器的运行时帮助程序
 */
export function resolveFilter(id: string): Function {
  return resolveAsset(this.$options, 'filters', id, true) || identity
}
