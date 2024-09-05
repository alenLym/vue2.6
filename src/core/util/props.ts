import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isArray,
  isObject,
  isFunction,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'
import type { Component } from 'types/component'

type PropOptions = {
  type: Function | Array<Function> | null
  default: any
  required?: boolean
  validator?: Function
}

export function validateProp(
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  const prop = propOptions[key]
  const absent = !hasOwn(propsData, key)
  let value = propsData[key]
  // 布尔强制转换
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  if (booleanIndex > -1) {
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } else if (value === '' || value === hyphenate(key)) {
      // Only cast empty string / same name to boolean if （仅将空字符串 / 相同名称转换为布尔值 if
// 布尔值具有更高的优先级
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true
      }
    }
  }
  // 检查默认值
  if (value === undefined) {
    value = getPropDefaultValue(vm, prop, key)
    // 由于默认值是新副本，因此
// 请务必遵守它。
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    observe(value)
    toggleObserving(prevShouldObserve)
  }
  if (__DEV__) {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * 获取 prop 的默认值。
 */
function getPropDefaultValue(
  vm: Component | undefined,
  prop: PropOptions,
  key: string
): any {
  // 无默认值，返回 undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // 对 Object & Array 的非出厂默认值发出警告
  if (__DEV__ && isObject(def)) {
    warn(
      'Invalid default value for prop "' +
        key +
        '": ' +
        'Props with type Object/Array must use a factory function ' +
        'to return the default value.',
      vm
    )
  }
  // raw prop 值在之前的渲染中也是未定义的，
// 返回以前的默认值以避免不必要的观察程序触发器
  if (
    vm &&
    vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // 为非 Function 类型调用 factory function
// 如果其原型是 function，则值为 Function，即使在不同的执行上下文中也是如此
  return isFunction(def) && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * 断言 prop 是否有效。
 */
function assertProp(
  prop: PropOptions,
  name: string,
  value: any,
  vm?: Component,
  absent?: boolean
) {
  if (prop.required && absent) {
    warn('Missing required prop: "' + name + '"', vm)
    return
  }
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || (type as any) === true
  const expectedTypes: string[] = []
  if (type) {
    if (!isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i], vm)
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }

  const haveExpectedTypes = expectedTypes.some(t => t)
  if (!valid && haveExpectedTypes) {
    warn(getInvalidTypeMessage(name, value, expectedTypes), vm)
    return
  }
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol|BigInt)$/

function assertType(
  value: any,
  type: Function,
  vm?: Component
): {
  valid: boolean
  expectedType: string
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // 对于 Primitive Wrapper 对象
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = isArray(value)
  } else {
    try {
      valid = value instanceof type
    } catch (e: any) {
      warn('Invalid prop type: "' + String(type) + '" is not a constructor', vm)
      valid = false
    }
  }
  return {
    valid,
    expectedType
  }
}

const functionTypeCheckRE = /^\s*function (\w+)/

/**
 * 使用函数字符串名称检查内置类型，因为在不同的 VM/iframe 之间运行时，简单的相等性检查将失败。
 */
function getType(fn) {
  const match = fn && fn.toString().match(functionTypeCheckRE)
  return match ? match[1] : ''
}

function isSameType(a, b) {
  return getType(a) === getType(b)
}

function getTypeIndex(type, expectedTypes): number {
  if (!isArray(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}

function getInvalidTypeMessage(name, value, expectedTypes) {
  let message =
    `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  // 检查是否需要指定期望值
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    isExplicable(typeof value) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${styleValue(value, expectedType)}`
  }
  message += `, got ${receivedType} `
  // 检查是否需要指定 received value
  if (isExplicable(receivedType)) {
    message += `with value ${styleValue(value, receivedType)}.`
  }
  return message
}

function styleValue(value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

const EXPLICABLE_TYPES = ['string', 'number', 'boolean']
function isExplicable(value) {
  return EXPLICABLE_TYPES.some(elem => value.toLowerCase() === elem)
}

function isBoolean(...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
