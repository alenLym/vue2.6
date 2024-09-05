import config from 'core/config'
import { hyphenate, isArray } from 'shared/util'

function isKeyNotMatch<T>(expect: T | Array<T>, actual: T): boolean {
  if (isArray(expect)) {
    return expect.indexOf(actual) === -1
  } else {
    return expect !== actual
  }
}

/**
 * 用于从 config 中检查 keyCodes 的运行时帮助程序。
 * 公开为 Vue.prototype._k
 * 单独传入 eventKeyName 作为向后兼容性的最后一个参数
 */
export function checkKeyCodes(
  eventKeyCode: number,
  key: string,
  builtInKeyCode?: number | Array<number>,
  eventKeyName?: string,
  builtInKeyName?: string | Array<string>
): boolean | null | undefined {
  const mappedKeyCode = config.keyCodes[key] || builtInKeyCode
  if (builtInKeyName && eventKeyName && !config.keyCodes[key]) {
    return isKeyNotMatch(builtInKeyName, eventKeyName)
  } else if (mappedKeyCode) {
    return isKeyNotMatch(mappedKeyCode, eventKeyCode)
  } else if (eventKeyName) {
    return hyphenate(eventKeyName) !== key
  }
  return eventKeyCode === undefined
}
