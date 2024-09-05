import { BindingMetadata } from 'sfc/types'

export type CompilerOptions = {
  warn?: Function // 允许在不同环境中自定义警告;例如 Node
  modules?: Array<ModuleOptions> // 平台特定模块;例如，风格;类
  directives?: { [key: string]: Function } // 特定于平台的指令
  staticKeys?: string // 被视为静态的 AST 属性列表;用于优化
  isUnaryTag?: (tag: string) => boolean | undefined // 检查标签是否为平台的一元
  canBeLeftOpenTag?: (tag: string) => boolean | undefined // 检查标记是否可以保持打开状态
  isReservedTag?: (tag: string) => boolean | undefined // 检查标记是否为平台的本机标记
  preserveWhitespace?: boolean // 保留元素之间的空格？（已弃用）
  whitespace?: 'preserve' | 'condense' // 空格处理策略
  optimize?: boolean // 优化静态内容？

  // web specific
  mustUseProp?: (tag: string, type: string | null, name: string) => boolean // 检查是否应将属性绑定为属性
  isPreTag?: (attr: string) => boolean | null // 检查标签是否需要保留空格
  getTagNamespace?: (tag: string) => string | undefined // 检查标记的命名空间
  expectHTML?: boolean // 对于非 Web 构建，仅 false
  isFromDOM?: boolean
  shouldDecodeTags?: boolean
  shouldDecodeNewlines?: boolean
  shouldDecodeNewlinesForHref?: boolean
  outputSourceRange?: boolean
  shouldKeepComment?: boolean

  // 运行时用户可配置
  delimiters?: [string, string] // 模板分隔符
  comments?: boolean // 在模板中保留注释

  // 对于 SSR 优化编译器
  scopeId?: string

  // SFC 分析了来自 'compileScript（）' 的脚本绑定
  bindings?: BindingMetadata
}

export type WarningMessage = {
  msg: string
  start?: number
  end?: number
}

export type CompiledResult = {
  ast: ASTElement | null
  render: string
  staticRenderFns: Array<string>
  stringRenderFns?: Array<string>
  errors?: Array<string | WarningMessage>
  tips?: Array<string | WarningMessage>
}

export type ModuleOptions = {
  // 在处理任何属性之前转换 AST 节点
// 从 pre/transforms 返回 ASTElement 将替换元素
  preTransformNode?: (el: ASTElement) => ASTElement | null | void
  // 在处理完 v-if、v-for 等内置函数后转换 AST 节点
  transformNode?: (el: ASTElement) => ASTElement | null | void
  // 在处理 AST 节点的子节点后转换 AST 节点
// 无法在 postTransform 中返回替换，因为 tree 已经完成
  postTransformNode?: (el: ASTElement) => void
  genData?: (el: ASTElement) => string // 为元素生成额外的数据字符串
  transformCode?: (el: ASTElement, code: string) => string // Further transform 为元素生成的代码
  staticKeys?: Array<string> // AST 属性被视为静态
}

export type ASTModifiers = { [key: string]: boolean }
export type ASTIfCondition = { exp: string | null; block: ASTElement }
export type ASTIfConditions = Array<ASTIfCondition>

export type ASTAttr = {
  name: string
  value: any
  dynamic?: boolean
  start?: number
  end?: number
}

export type ASTElementHandler = {
  value: string
  params?: Array<any>
  modifiers: ASTModifiers | null
  dynamic?: boolean
  start?: number
  end?: number
}

export type ASTElementHandlers = {
  [key: string]: ASTElementHandler | Array<ASTElementHandler>
}

export type ASTDirective = {
  name: string
  rawName: string
  value: string
  arg: string | null
  isDynamicArg: boolean
  modifiers: ASTModifiers | null
  start?: number
  end?: number
}

export type ASTNode = ASTElement | ASTText | ASTExpression

export type ASTElement = {
  type: 1
  tag: string
  attrsList: Array<ASTAttr>
  attrsMap: { [key: string]: any }
  rawAttrsMap: { [key: string]: ASTAttr }
  parent: ASTElement | void
  children: Array<ASTNode>

  start?: number
  end?: number

  processed?: true

  static?: boolean
  staticRoot?: boolean
  staticInFor?: boolean
  staticProcessed?: boolean
  hasBindings?: boolean

  text?: string
  attrs?: Array<ASTAttr>
  dynamicAttrs?: Array<ASTAttr>
  props?: Array<ASTAttr>
  plain?: boolean
  pre?: true
  ns?: string

  component?: string
  inlineTemplate?: true
  transitionMode?: string | null
  slotName?: string | null
  slotTarget?: string | null
  slotTargetDynamic?: boolean
  slotScope?: string | null
  scopedSlots?: { [name: string]: ASTElement }

  ref?: string
  refInFor?: boolean

  if?: string
  ifProcessed?: boolean
  elseif?: string
  else?: true
  ifConditions?: ASTIfConditions

  for?: string
  forProcessed?: boolean
  key?: string
  alias?: string
  iterator1?: string
  iterator2?: string

  staticClass?: string
  classBinding?: string
  staticStyle?: string
  styleBinding?: string
  events?: ASTElementHandlers
  nativeEvents?: ASTElementHandlers

  transition?: string | true
  transitionOnAppear?: boolean

  model?: {
    value: string
    callback: string
    expression: string
  }

  directives?: Array<ASTDirective>

  forbidden?: true
  once?: true
  onceProcessed?: boolean
  wrapData?: (code: string) => string
  wrapListeners?: (code: string) => string

  // 2.4 ssr optimization
  ssrOptimizability?: number
}

export type ASTExpression = {
  type: 2
  expression: string
  text: string
  tokens: Array<string | Object>
  static?: boolean
  // 2.4 ssr optimization
  ssrOptimizability?: number
  start?: number
  end?: number
}

export type ASTText = {
  type: 3
  text: string
  static?: boolean
  isComment?: boolean
  // 2.4 SSR 优化
  ssrOptimizability?: number
  start?: number
  end?: number
}
