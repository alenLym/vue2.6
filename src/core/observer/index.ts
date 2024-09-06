import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  isArray,
  hasProto,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering,
  hasChanged,
  noop
} from '../util/index'
import { isReadonly, isRef, TrackOpTypes, TriggerOpTypes } from '../../v3'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

const NO_INITIAL_VALUE = {}

/**
 * 在某些情况下，我们可能希望在组件的更新计算中禁用 Observation。
 */
export let shouldObserve: boolean = true

// 该函数用于切换观察者模式的状态。参数value表示是否应该观察。
// 函数执行后，将根据传入的value值来决定是否进行观察。
export function toggleObserving(value: boolean) {
  shouldObserve = value
}

// SSR 模拟 dep
const mockDep = {
  notify: noop,
  depend: noop,
  addSub: noop,
  removeSub: noop
} as Dep

/**
 * 附加到每个被观察对象的 Observer 类。附加后，观察者将目标对象的属性键转换为收集依赖项并分派更新的 getter/setter。
 */


// 构造函数：接收一个值 value 并初始化依赖追踪对象 dep 和虚拟机计数器 vmCount。
// 通过 def 函数将当前观察者实例设置为 value 的 __ob__ 属性。

// 数组处理：
// 如果 value 是数组且不处于模拟模式，则修改其原型指向 arrayMethods 或将数组方法定义为其属性。
// 若不是浅层观察，则递归观察数组中的每个元素。

// 对象处理：若 value 是对象，则遍历其所有键并使用 defineReactive 方法将其转换为响应式属性。
export class Observer {
  // 依赖收集器
  dep: Dep

  vmCount: number // 将此对象作为根$data的 VM 数

  constructor(public value: any, public shallow = false, public mock = false) {
    // this.value = 值
    //
    this.dep = mock ? mockDep : new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)
    if (isArray(value)) {
      if (!mock) {
        if (hasProto) {
          /* eslint-disable no-proto */
          ; (value as any).__proto__ = arrayMethods
          /* eslint-enable no-proto */
        } else {
          for (let i = 0, l = arrayKeys.length; i < l; i++) {
            const key = arrayKeys[i]
            def(value, key, arrayMethods[key])
          }
        }
      }
      if (!shallow) {
        // !递归观察数组中的每个元素
        this.observeArray(value)
      }
    } else {
      /**
       * 遍历所有属性并将它们转换为 getter/setter。仅当值类型为 Object 时，才应调用此方法。
       */
      const keys = Object.keys(value)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        // !只对可枚举属性进行响应式转换
        defineReactive(value, key, NO_INITIAL_VALUE, undefined, shallow, mock)
      }
    }
  }

  /**
   * 观察 Array 项的列表。
   */
  observeArray(value: any[]) {
    for (let i = 0, l = value.length; i < l; i++) {
      observe(value[i], false, this.mock)
    }
  }
}

// 助手
/**
 * 尝试为值创建观察者实例，如果成功观察，则返回新的观察者，如果值已有观察者，则返回现有观察者。
 */

// 如果传入值已存在__ob__属性且为Observer实例，则直接返回该实例。
// 满足以下条件时，创建并返回新的Observer实例：
// 允许观察；
// 非服务器渲染或模拟响应式模式；
// 是数组或普通对象；
// 可扩展；
// 未设置__v_skip标志；
// 不是引用类型；
// 不是VNode实例。
export function observe(
  value: any,
  shallow?: boolean,
  ssrMockReactivity?: boolean
): Observer | void {
  if (value && hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    return value.__ob__
  }
  if (
    shouldObserve &&
    (ssrMockReactivity || !isServerRendering()) &&
    (isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value.__v_skip /* 响应式 flags.skip*/ &&
    !isRef(value) &&
    !(value instanceof VNode)
  ) {
    //! 创建并返回新的Observer实例
    return new Observer(value, shallow, ssrMockReactivity)
  }
}

/**
 * 在 Object 上定义响应式属性。
 */

// 创建依赖收集器 dep。
// 获取对象 obj 中 key 属性的描述符，并判断是否可配置，若不可配置则直接返回。
// 根据已有 getter 和 setter 进行处理，并获取初始值 val。
// 观察 val 的响应式状态，生成 childOb。
// 使用 Object.defineProperty 定义新的 getter 和 setter：
// getter：收集依赖并返回值，处理嵌套响应式和数组依赖。
// setter：检查新值是否改变，并更新值与子观察者 childOb，通知依赖更新。
export function defineReactive(
  obj: object,
  key: string,
  val?: any,
  customSetter?: Function | null,
  shallow?: boolean,
  mock?: boolean,
  observeEvenIfShallow = false
) {
  //!实例化 依赖收集器 dep
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // 满足预定义的 getter/setter
  const getter = property && property.get
  const setter = property && property.set
  if (
    (!getter || setter) &&
    (val === NO_INITIAL_VALUE || arguments.length === 2)
  ) {
    val = obj[key]
  }

  let childOb = shallow ? val && val.__ob__ : observe(val, false, mock)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        if (__DEV__) {
          //! 收集依赖
          dep.depend({
            target: obj,
            type: TrackOpTypes.GET,
            key
          })
        } else {
          //! 收集依赖
          dep.depend()
        }
        if (childOb) {
          childOb.dep.depend()
          if (isArray(value)) {
            dependArray(value)
          }
        }
      }
      return isRef(value) && !shallow ? value.value : value
    },
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val
      if (!hasChanged(value, newVal)) {
        return
      }
      if (__DEV__ && customSetter) {
        customSetter()
      }
      if (setter) {
        setter.call(obj, newVal)
      } else if (getter) {
        // #7981： 对于没有 setter 的访问器属性
        return
      } else if (!shallow && isRef(value) && !isRef(newVal)) {
        value.value = newVal
        return
      } else {
        val = newVal
      }
      childOb = shallow ? newVal && newVal.__ob__ : observe(newVal, false, mock)
      if (__DEV__) {
        //! 通知依赖更新
        dep.notify({
          type: TriggerOpTypes.SET,
          target: obj,
          key,
          newValue: newVal,
          oldValue: value
        })
      } else {
        //! 通知依赖更新
        dep.notify()
      }
    }
  })

  return dep
}

/**
 * 在对象上设置属性。添加新属性，如果该属性尚不存在，则触发更改通知。
 */
export function set<T>(array: T[], key: number, value: T): T
export function set<T>(object: object, key: string | number, value: T): T


// 检查目标是否为未定义、空或原始值，若是则警告无法设置。
// 若目标为只读，则警告设置失败。
// 对于数组且键为有效索引的情况，调整数组长度并使用 splice 方法更新值。
// 对象已存在键时直接更新值。
// 若目标为 Vue 实例或其数据对象，警告避免运行时添加响应式属性。
// 若目标无观察者 (ob)，直接设置属性值。
// 否则，使用 defineReactive 方法将新属性设置为响应式，并通知观察者更新。
export function set(
  target: any[] | Record<string, any>,
  key: any,
  val: any
): any {
  if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${target}`
    )
  }
  if (isReadonly(target)) {
    __DEV__ && warn(`Set operation on key "${key}" failed: target is readonly.`)
    return
  }
  const ob = (target as any).__ob__
  //! 调整数组长度并更新值
  if (isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    // 当模拟 SSR 时，数组方法不会被劫持
    if (ob && !ob.shallow && ob.mock) {
      //! 观察 val 的响应式状态，生成 childOb。如果 val 是对象，则 childOb 是一个观察者，否则为 undefined。
      observe(val, false, true)
    }
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  if ((target as any)._isVue || (ob && ob.vmCount)) {
    __DEV__ &&
      warn(
        'Avoid adding reactive properties to a Vue instance or its root $data ' +
        'at runtime - declare it upfront in the data option.'
      )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  //! 观察 val 的响应式状态，生成 childOb。
  defineReactive(ob.value, key, val, undefined, ob.shallow, ob.mock)
  if (__DEV__) {
    //! 通知依赖更新
    ob.dep.notify({
      type: TriggerOpTypes.ADD,
      target: target,
      key,
      newValue: val,
      oldValue: undefined
    })
  } else {
    //! 通知依赖更新
    ob.dep.notify()
  }
  return val
}

/**
 * 删除属性并在必要时触发更改。
 */
export function del<T>(array: T[], key: number): void
export function del(object: object, key: string | number): void

// 删除目标对象或数组中的指定键值。
// 对于数组，如果键是有效索引，则使用 splice 方法删除元素。
// 检查目标是否为 Vue 实例或其 $data，如果是，则发出警告并返回。
// 检查目标是否为只读，如果是，则发出警告并返回。
// 如果目标不包含键，则直接返回。
// 删除目标上的键值，并通知观察者（Observer）进行更新。
export function del(target: any[] | object, key: any) {
  if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${target}`
    )
  }
  if (isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target as any).__ob__
  if ((target as any)._isVue || (ob && ob.vmCount)) {
    __DEV__ &&
      warn(
        'Avoid deleting properties on a Vue instance or its root $data ' +
        '- just set it to null.'
      )
    return
  }
  if (isReadonly(target)) {
    __DEV__ &&
      warn(`Delete operation on key "${key}" failed: target is readonly.`)
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  if (__DEV__) {
    //! 通知依赖更新
    ob.dep.notify({
      type: TriggerOpTypes.DELETE,
      target: target,
      key
    })
  } else {
    //! 通知依赖更新
    ob.dep.notify()
  }
}

/**
 * 当数组被触摸时收集对数组元素的依赖，因为我们无法像属性 getter 那样拦截数组元素访问。
 */

// 遍历数组每个元素；
// 如果元素有__ob__属性，则调用其dep.depend()方法收集依赖；
// 如果元素是数组，递归调用自身继续收集依赖。
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    if (e && e.__ob__) {
      //! 收集依赖
      e.__ob__.dep.depend()
    }
    if (isArray(e)) {
      dependArray(e)
    }
  }
}
