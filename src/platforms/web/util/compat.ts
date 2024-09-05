import { inBrowser } from 'core/util/index'

// 检查当前浏览器是否在 attribute 值内编码了 char
let div
function getShouldDecode(href: boolean): boolean {
  div = div || document.createElement('div')
  div.innerHTML = href ? `<a href="\n"/>` : `<div a="\n"/>`
  return div.innerHTML.indexOf('&#10;') > 0
}

// #3663： IE 在属性值内对换行符进行编码，而其他浏览器则不编码
export const shouldDecodeNewlines = inBrowser ? getShouldDecode(false) : false
// #6828： Chrome 在 A[href] 中对内容进行编码
export const shouldDecodeNewlinesForHref = inBrowser
  ? getShouldDecode(true)
  : false
