import Watcher from 'core/observer/watcher'
import { noop } from 'shared/util'
import { currentInstance } from '../currentInstance'

// 导出类型 EffectScheduler = （...args： any[]） => 任何
/**
 * @internal 由于我们没有在 Vue 2 中公开它，它仅用于
 * 内部测试。
 */
export function effect(fn: () => any, scheduler?: (cb: any) => void) {
  const watcher = new Watcher(currentInstance, fn, noop, {
    sync: true
  })
  if (scheduler) {
    watcher.update = () => {
      scheduler(() => watcher.run())
    }
  }
}
