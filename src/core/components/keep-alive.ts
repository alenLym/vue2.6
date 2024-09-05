import { isRegExp, isArray, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'
import type VNode from 'core/vdom/vnode'
import type { VNodeComponentOptions } from 'types/vnode'
import type { Component } from 'types/component'
import { getComponentName } from '../vdom/create-component'

type CacheEntry = {
  name?: string
  tag?: string
  componentInstance?: Component
}

type CacheEntryMap = Record<string, CacheEntry | null>

function _getComponentName(opts?: VNodeComponentOptions): string | null {
  return opts && (getComponentName(opts.Ctor.options as any) || opts.tag)
}

function matches(
  pattern: string | RegExp | Array<string>,
  name: string
): boolean {
  if (isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

function pruneCache(
  keepAliveInstance: {
    cache: CacheEntryMap
    keys: string[]
    _vnode: VNode
    $vnode: VNode
  },
  filter: Function
) {
  const { cache, keys, _vnode, $vnode } = keepAliveInstance
  for (const key in cache) {
    const entry = cache[key]
    if (entry) {
      const name = entry.name
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
  $vnode.componentOptions!.children = undefined
}

function pruneCacheEntry(
  cache: CacheEntryMap,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const entry = cache[key]
  if (entry && (!current || entry.tag !== current.tag)) {
    // @ts-expect-error can be undefined
    entry.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

// TODO defineComponent
export default {
  name: 'keep-alive',
  abstract: true,

  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  methods: {
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        cache[keyToCache] = {
          name: _getComponentName(componentOptions),
          tag,
          componentInstance
        }
        keys.push(keyToCache)
        // 修剪最旧的条目
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        this.vnodeToCache = null
      }
    }
  },

  created() {
    this.cache = Object.create(null)
    this.keys = []
  },

  destroyed() {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted() {
    this.cacheVNode()
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated() {
    this.cacheVNode()
  },

  render() {
    const slot = this.$slots.default
    const vnode = getFirstComponentChild(slot)
    const componentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // 格纹
      const name = _getComponentName(componentOptions)
      const { include, exclude } = this
      if (
        // 不包括
        (include && (!name || !matches(include, name))) ||
        // 排除
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      const key =
        vnode.key == null
          ? // 相同的构造函数可能会注册为不同的本地组件
// 所以单独的 CID 是不够的 （#3269）
            componentOptions.Ctor.cid +
            (componentOptions.tag ? `::${componentOptions.tag}` : '')
          : vnode.key
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // 使当前密钥最新
        remove(keys, key)
        keys.push(key)
      } else {
        // 延迟设置缓存直到更新
        this.vnodeToCache = vnode
        this.keyToCache = key
      }

      // @ts-expect-error 可以是 vnode.data 可以是 undefined
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
