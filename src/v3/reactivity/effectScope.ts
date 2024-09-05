import Watcher from 'core/observer/watcher'
import { warn } from 'core/util'

export let activeEffectScope: EffectScope | undefined

export class EffectScope {
  /**
   * @internal
   */
  active = true
  /**
   * @internal
   */
  effects: Watcher[] = []
  /**
   * @internal
   */
  cleanups: (() => void)[] = []
  /**
   * @internal
   */
  parent: EffectScope | undefined
  /**
   * 记录未分离的范围
   * @internal
   */
  scopes: EffectScope[] | undefined
  /**
   * 表示这是组件根范围
   * @internal
   */
  _vm?: boolean
  /**
   * 跟踪子 scope 在其父 scopes 数组中的索引以进行优化
   * 免职
   */
  private index: number | undefined

  constructor(public detached = false) {
    this.parent = activeEffectScope
    if (!detached && activeEffectScope) {
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  /**
   * 这应该只在非分离的作用域上调用
   * @internal
   */
  on() {
    activeEffectScope = this
  }

  /**
   * 这应该只在非分离的作用域上调用
   * @internal
   */
  off() {
    activeEffectScope = this.parent
  }

  stop(fromParent?: boolean) {
    if (this.active) {
      let i, l
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].teardown()
      }
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true)
        }
      }
      // 嵌套范围，从 parent 取消引用以避免内存泄漏
      if (!this.detached && this.parent && !fromParent) {
        // 优化的 O（1） 去除
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.parent = undefined
      this.active = false
    }
  }
}

export function effectScope(detached?: boolean) {
  return new EffectScope(detached)
}

/**
 * @internal
 */
export function recordEffectScope(
  effect: Watcher,
  scope: EffectScope | undefined = activeEffectScope
) {
  if (scope && scope.active) {
    scope.effects.push(effect)
  }
}

export function getCurrentScope() {
  return activeEffectScope
}

export function onScopeDispose(fn: () => void) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
        ` to be associated with.`
    )
  }
}
