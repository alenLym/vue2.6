import { genHandlers } from './events'
import baseDirectives from '../directives/index'
import { camelize, no, extend, capitalize } from 'shared/util'
import { baseWarn, pluckModuleFunction } from '../helpers'
import { emptySlotScopeToken } from '../parser/index'
import {
  ASTAttr,
  ASTDirective,
  ASTElement,
  ASTExpression,
  ASTIfConditions,
  ASTNode,
  ASTText,
  CompilerOptions
} from 'types/compiler'
import { BindingMetadata, BindingTypes } from 'sfc/types'

type TransformFunction = (el: ASTElement, code: string) => string
type DataGenFunction = (el: ASTElement) => string
type DirectiveFunction = (
  el: ASTElement,
  dir: ASTDirective,
  warn: Function
) => boolean

export class CodegenState {
  options: CompilerOptions
  warn: Function
  transforms: Array<TransformFunction>
  dataGenFns: Array<DataGenFunction>
  directives: { [key: string]: DirectiveFunction }
  maybeComponent: (el: ASTElement) => boolean
  onceId: number
  staticRenderFns: Array<string>
  pre: boolean

  constructor(options: CompilerOptions) {
    this.options = options
    this.warn = options.warn || baseWarn
    this.transforms = pluckModuleFunction(options.modules, 'transformCode')
    this.dataGenFns = pluckModuleFunction(options.modules, 'genData')
    this.directives = extend(extend({}, baseDirectives), options.directives)
    const isReservedTag = options.isReservedTag || no
    this.maybeComponent = (el: ASTElement) =>
      !!el.component || !isReservedTag(el.tag)
    this.onceId = 0
    this.staticRenderFns = []
    this.pre = false
  }
}

export type CodegenResult = {
  render: string
  staticRenderFns: Array<string>
}

export function generate(
  ast: ASTElement | void,
  options: CompilerOptions
): CodegenResult {
  const state = new CodegenState(options)
  // 修复 #11483，<script>不应渲染根级别标签。
  const code = ast
    ? ast.tag === 'script'
      ? 'null'
      : genElement(ast, state)
    : '_c("div")'
  return {
    render: `with(this){return ${code}}`,
    staticRenderFns: state.staticRenderFns
  }
}

export function genElement(el: ASTElement, state: CodegenState): string {
  if (el.parent) {
    el.pre = el.pre || el.parent.pre
  }

  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el, state)
  } else if (el.once && !el.onceProcessed) {
    return genOnce(el, state)
  } else if (el.for && !el.forProcessed) {
    return genFor(el, state)
  } else if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  } else if (el.tag === 'template' && !el.slotTarget && !state.pre) {
    return genChildren(el, state) || 'void 0'
  } else if (el.tag === 'slot') {
    return genSlot(el, state)
  } else {
    // 组件或元素
    let code
    if (el.component) {
      code = genComponent(el.component, el, state)
    } else {
      let data
      const maybeComponent = state.maybeComponent(el)
      if (!el.plain || (el.pre && maybeComponent)) {
        data = genData(el, state)
      }

      let tag: string | undefined
      // 检查这是否是 <Script Setup 中的组件>
      const bindings = state.options.bindings
      if (maybeComponent && bindings && bindings.__isScriptSetup !== false) {
        tag = checkBindingType(bindings, el.tag)
      }
      if (!tag) tag = `'${el.tag}'`

      const children = el.inlineTemplate ? null : genChildren(el, state, true)
      code = `_c(${tag}${
        data ? `,${data}` : '' // data
      }${
        children ? `,${children}` : '' // children
      })`
    }
    // 模块转换
    for (let i = 0; i < state.transforms.length; i++) {
      code = state.transforms[i](el, code)
    }
    return code
  }
}

function checkBindingType(bindings: BindingMetadata, key: string) {
  const camelName = camelize(key)
  const PascalName = capitalize(camelName)
  const checkType = (type) => {
    if (bindings[key] === type) {
      return key
    }
    if (bindings[camelName] === type) {
      return camelName
    }
    if (bindings[PascalName] === type) {
      return PascalName
    }
  }
  const fromConst =
    checkType(BindingTypes.SETUP_CONST) ||
    checkType(BindingTypes.SETUP_REACTIVE_CONST)
  if (fromConst) {
    return fromConst
  }

  const fromMaybeRef =
    checkType(BindingTypes.SETUP_LET) ||
    checkType(BindingTypes.SETUP_REF) ||
    checkType(BindingTypes.SETUP_MAYBE_REF)
  if (fromMaybeRef) {
    return fromMaybeRef
  }
}

// hoist static sub-trees out
function genStatic(el: ASTElement, state: CodegenState): string {
  el.staticProcessed = true
  // 一些元素（模板）在 v-pre 节点中需要有不同的行为。 所有 pre 节点都是静态根，因此我们可以将其用作包装状态更改并在退出 pre 节点时重置它的位置。
  const originalPreState = state.pre
  if (el.pre) {
    state.pre = el.pre
  }
  state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`)
  state.pre = originalPreState
  return `_m(${state.staticRenderFns.length - 1}${
    el.staticInFor ? ',true' : ''
  })`
}

// v-once
function genOnce(el: ASTElement, state: CodegenState): string {
  el.onceProcessed = true
  if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  } else if (el.staticInFor) {
    let key = ''
    let parent = el.parent
    while (parent) {
      if (parent.for) {
        key = parent.key!
        break
      }
      parent = parent.parent
    }
    if (!key) {
      __DEV__ &&
        state.warn(
          `v-once can only be used inside v-for that is keyed. `,
          el.rawAttrsMap['v-once']
        )
      return genElement(el, state)
    }
    return `_o(${genElement(el, state)},${state.onceId++},${key})`
  } else {
    return genStatic(el, state)
  }
}

export function genIf(
  el: any,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  el.ifProcessed = true // avoid recursion
  return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}

function genIfConditions(
  conditions: ASTIfConditions,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  if (!conditions.length) {
    return altEmpty || '_e()'
  }

  const condition = conditions.shift()!
  if (condition.exp) {
    return `(${condition.exp})?${genTernaryExp(
      condition.block
    )}:${genIfConditions(conditions, state, altGen, altEmpty)}`
  } else {
    return `${genTernaryExp(condition.block)}`
  }

  // v-if 和 v-once 应该生成类似 （a）？_m（0）：_m（1） 的代码
  function genTernaryExp(el) {
    return altGen
      ? altGen(el, state)
      : el.once
      ? genOnce(el, state)
      : genElement(el, state)
  }
}

export function genFor(
  el: any,
  state: CodegenState,
  altGen?: Function,
  altHelper?: string
): string {
  const exp = el.for
  const alias = el.alias
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

  if (
    __DEV__ &&
    state.maybeComponent(el) &&
    el.tag !== 'slot' &&
    el.tag !== 'template' &&
    !el.key
  ) {
    state.warn(
      `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
        `v-for should have explicit keys. ` +
        `See https://v2.vuejs.org/v2/guide/list.html#key for more info.`,
      el.rawAttrsMap['v-for'],
      true /* tip */
    )
  }

  el.forProcessed = true // avoid recursion
  return (
    `${altHelper || '_l'}((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
    `return ${(altGen || genElement)(el, state)}` +
    '})'
  )
}

export function genData(el: ASTElement, state: CodegenState): string {
  let data = '{'

  // 指令。
// 指令可以在生成 EL 的其他属性之前对其进行更改。
  const dirs = genDirectives(el, state)
  if (dirs) data += dirs + ','

  // key
  if (el.key) {
    data += `key:${el.key},`
  }
  // ref
  if (el.ref) {
    data += `ref:${el.ref},`
  }
  if (el.refInFor) {
    data += `refInFor:true,`
  }
  // pre
  if (el.pre) {
    data += `pre:true,`
  }
  // 使用 “is” 属性记录组件的原始标签名称
  if (el.component) {
    data += `tag:"${el.tag}",`
  }
  // 模块数据生成函数
  for (let i = 0; i < state.dataGenFns.length; i++) {
    data += state.dataGenFns[i](el)
  }
  // 属性
  if (el.attrs) {
    data += `attrs:${genProps(el.attrs)},`
  }
  // DOM 属性
  if (el.props) {
    data += `domProps:${genProps(el.props)},`
  }
  // 事件处理程序
  if (el.events) {
    data += `${genHandlers(el.events, false)},`
  }
  if (el.nativeEvents) {
    data += `${genHandlers(el.nativeEvents, true)},`
  }
  // slot 目标
// 仅适用于非范围槽
  if (el.slotTarget && !el.slotScope) {
    data += `slot:${el.slotTarget},`
  }
  // 范围插槽
  if (el.scopedSlots) {
    data += `${genScopedSlots(el, el.scopedSlots, state)},`
  }
  // 组件 V 模型
  if (el.model) {
    data += `model:{value:${el.model.value},callback:${el.model.callback},expression:${el.model.expression}},`
  }
  // 内联模板
  if (el.inlineTemplate) {
    const inlineTemplate = genInlineTemplate(el, state)
    if (inlineTemplate) {
      data += `${inlineTemplate},`
    }
  }
  data = data.replace(/,$/, '') + '}'
  // v-bind 动态参数包装
// 带有动态参数的 v-bind 必须使用相同的 v-bind 对象
// merge 辅助函数，以便正确处理 class/style/mustUseProp 属性。
  if (el.dynamicAttrs) {
    data = `_b(${data},"${el.tag}",${genProps(el.dynamicAttrs)})`
  }
  // v-bind 数据包装
  if (el.wrapData) {
    data = el.wrapData(data)
  }
  // v-on 数据包装
  if (el.wrapListeners) {
    data = el.wrapListeners(data)
  }
  return data
}

function genDirectives(el: ASTElement, state: CodegenState): string | void {
  const dirs = el.directives
  if (!dirs) return
  let res = 'directives:['
  let hasRuntime = false
  let i, l, dir, needRuntime
  for (i = 0, l = dirs.length; i < l; i++) {
    dir = dirs[i]
    needRuntime = true
    const gen: DirectiveFunction = state.directives[dir.name]
    if (gen) {
      // 编译时指令。
// 如果它还需要运行时对应项，则返回 true。
      needRuntime = !!gen(el, dir, state.warn)
    }
    if (needRuntime) {
      hasRuntime = true
      res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
        dir.value
          ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}`
          : ''
      }${dir.arg ? `,arg:${dir.isDynamicArg ? dir.arg : `"${dir.arg}"`}` : ''}${
        dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
      }},`
    }
  }
  if (hasRuntime) {
    return res.slice(0, -1) + ']'
  }
}

function genInlineTemplate(
  el: ASTElement,
  state: CodegenState
): string | undefined {
  const ast = el.children[0]
  if (__DEV__ && (el.children.length !== 1 || ast.type !== 1)) {
    state.warn(
      'Inline-template components must have exactly one child element.',
      { start: el.start }
    )
  }
  if (ast && ast.type === 1) {
    const inlineRenderFns = generate(ast, state.options)
    return `inlineTemplate:{render:function(){${
      inlineRenderFns.render
    }},staticRenderFns:[${inlineRenderFns.staticRenderFns
      .map(code => `function(){${code}}`)
      .join(',')}]}`
  }
}

function genScopedSlots(
  el: ASTElement,
  slots: { [key: string]: ASTElement },
  state: CodegenState
): string {
  // 默认情况下，作用域的插槽被认为是 “稳定的”，这允许子
// 组件，用于跳过来自 Parent 的强制更新。
// 但在某些情况下，我们必须摆脱这种优化
// 例如，如果插槽包含动态名称，上面有 v-if 或 v-for......
  let needsForceUpdate =
    el.for ||
    Object.keys(slots).some(key => {
      const slot = slots[key]
      return (
        slot.slotTargetDynamic || slot.if || slot.for || containsSlotChild(slot) // 是从父级向下传递插槽，这可能是动态的
      )
    })

  // #9534： 如果具有作用域插槽的组件位于条件分支内，
// 可以重复使用相同的组件，但使用不同的
// 编译的插槽内容。为了避免这种情况，我们根据
// 所有插槽内容的生成代码。
  let needsKey = !!el.if

  // 或者当它位于另一个作用域插槽或 v-for 内时（由于中间作用域变量，响应性可能会断开连接）
// #9438, #9506
// TODO：这可以通过正确分析范围内绑定并跳过实际不使用范围变量的绑定来进一步优化。
  if (!needsForceUpdate) {
    let parent = el.parent
    while (parent) {
      if (
        (parent.slotScope && parent.slotScope !== emptySlotScopeToken) ||
        parent.for
      ) {
        needsForceUpdate = true
        break
      }
      if (parent.if) {
        needsKey = true
      }
      parent = parent.parent
    }
  }

  const generatedSlots = Object.keys(slots)
    .map(key => genScopedSlot(slots[key], state))
    .join(',')

  return `scopedSlots:_u([${generatedSlots}]${
    needsForceUpdate ? `,null,true` : ``
  }${
    !needsForceUpdate && needsKey ? `,null,false,${hash(generatedSlots)}` : ``
  })`
}

function hash(str) {
  let hash = 5381
  let i = str.length
  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i)
  }
  return hash >>> 0
}

function containsSlotChild(el: ASTNode): boolean {
  if (el.type === 1) {
    if (el.tag === 'slot') {
      return true
    }
    return el.children.some(containsSlotChild)
  }
  return false
}

function genScopedSlot(el: ASTElement, state: CodegenState): string {
  const isLegacySyntax = el.attrsMap['slot-scope']
  if (el.if && !el.ifProcessed && !isLegacySyntax) {
    return genIf(el, state, genScopedSlot, `null`)
  }
  if (el.for && !el.forProcessed) {
    return genFor(el, state, genScopedSlot)
  }
  const slotScope =
    el.slotScope === emptySlotScopeToken ? `` : String(el.slotScope)
  const fn =
    `function(${slotScope}){` +
    `return ${
      el.tag === 'template'
        ? el.if && isLegacySyntax
          ? `(${el.if})?${genChildren(el, state) || 'undefined'}:undefined`
          : genChildren(el, state) || 'undefined'
        : genElement(el, state)
    }}`
  // 反向代理 v-slot 没有 this 的 scope $slots
  const reverseProxy = slotScope ? `` : `,proxy:true`
  return `{key:${el.slotTarget || `"default"`},fn:${fn}${reverseProxy}}`
}

export function genChildren(
  el: ASTElement,
  state: CodegenState,
  checkSkip?: boolean,
  altGenElement?: Function,
  altGenNode?: Function
): string | void {
  const children = el.children
  if (children.length) {
    const el: any = children[0]
    // 优化单个 V-For
    if (
      children.length === 1 &&
      el.for &&
      el.tag !== 'template' &&
      el.tag !== 'slot'
    ) {
      const normalizationType = checkSkip
        ? state.maybeComponent(el)
          ? `,1`
          : `,0`
        : ``
      return `${(altGenElement || genElement)(el, state)}${normalizationType}`
    }
    const normalizationType = checkSkip
      ? getNormalizationType(children, state.maybeComponent)
      : 0
    const gen = altGenNode || genNode
    return `[${children.map(c => gen(c, state)).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''
    }`
  }
}

// 确定 children 数组所需的规范化。
// 0：无需标准化
// 1：需要简单规范化（可能是 1 层深嵌套数组）
// 2：需要完全规范化
function getNormalizationType(
  children: Array<ASTNode>,
  maybeComponent: (el: ASTElement) => boolean
): number {
  let res = 0
  for (let i = 0; i < children.length; i++) {
    const el: ASTNode = children[i]
    if (el.type !== 1) {
      continue
    }
    if (
      needsNormalization(el) ||
      (el.ifConditions &&
        el.ifConditions.some(c => needsNormalization(c.block)))
    ) {
      res = 2
      break
    }
    if (
      maybeComponent(el) ||
      (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))
    ) {
      res = 1
    }
  }
  return res
}

function needsNormalization(el: ASTElement): boolean {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

function genNode(node: ASTNode, state: CodegenState): string {
  if (node.type === 1) {
    return genElement(node, state)
  } else if (node.type === 3 && node.isComment) {
    return genComment(node)
  } else {
    return genText(node)
  }
}

export function genText(text: ASTText | ASTExpression): string {
  return `_v(${
    text.type === 2
      ? text.expression // 不需要 （），因为已经包装在 _s（） 中
      : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}

export function genComment(comment: ASTText): string {
  return `_e(${JSON.stringify(comment.text)})`
}

function genSlot(el: ASTElement, state: CodegenState): string {
  const slotName = el.slotName || '"default"'
  const children = genChildren(el, state)
  let res = `_t(${slotName}${children ? `,function(){return ${children}}` : ''}`
  const attrs =
    el.attrs || el.dynamicAttrs
      ? genProps(
          (el.attrs || []).concat(el.dynamicAttrs || []).map(attr => ({
            // slot props 被驼峰化
            name: camelize(attr.name),
            value: attr.value,
            dynamic: attr.dynamic
          }))
        )
      : null
  const bind = el.attrsMap['v-bind']
  if ((attrs || bind) && !children) {
    res += `,null`
  }
  if (attrs) {
    res += `,${attrs}`
  }
  if (bind) {
    res += `${attrs ? '' : ',null'},${bind}`
  }
  return res + ')'
}

// componentName 为 el.component，将其作为参数来避开 flow 的悲观细化
function genComponent(
  componentName: string,
  el: ASTElement,
  state: CodegenState
): string {
  const children = el.inlineTemplate ? null : genChildren(el, state, true)
  return `_c(${componentName},${genData(el, state)}${
    children ? `,${children}` : ''
  })`
}

function genProps(props: Array<ASTAttr>): string {
  let staticProps = ``
  let dynamicProps = ``
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    const value = transformSpecialNewlines(prop.value)
    if (prop.dynamic) {
      dynamicProps += `${prop.name},${value},`
    } else {
      staticProps += `"${prop.name}":${value},`
    }
  }
  staticProps = `{${staticProps.slice(0, -1)}}`
  if (dynamicProps) {
    return `_d(${staticProps},[${dynamicProps.slice(0, -1)}])`
  } else {
    return staticProps
  }
}

// #3895, #4268
function transformSpecialNewlines(text: string): string {
  return text.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
