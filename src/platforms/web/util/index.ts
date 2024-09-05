import { warn } from 'core/util/index'

export * from './attrs'
export * from './class'
export * from './element'

/**
 * 如果元素选择器还不是元素，请查询该选择器。
 */
export function query(el: string | Element): Element {
  if (typeof el === 'string') {
    const selected = document.querySelector(el)
    if (!selected) {
      __DEV__ && warn('Cannot find element: ' + el)
      return document.createElement('div')
    }
    return selected
  } else {
    return el
  }
}
