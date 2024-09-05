import { ASTElement, ASTNode } from 'types/compiler'
import { dirRE, onRE } from './parser/index'

type Range = { start?: number; end?: number }

// 这些关键字不应出现在表达式中，但
// typeof、instanceof 和 in 是允许的
const prohibitedKeywordRE = new RegExp(
  '\\b' +
    (
      'do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,' +
      'super,throw,while,yield,delete,export,import,return,switch,default,' +
      'extends,finally,continue,debugger,function,arguments'
    )
      .split(',')
      .join('\\b|\\b') +
    '\\b'
)

// 这些一元运算符不应用作属性/方法名称
const unaryOperatorsRE = new RegExp(
  '\\b' +
    'delete,typeof,void'.split(',').join('\\s*\\([^\\)]*\\)|\\b') +
    '\\s*\\([^\\)]*\\)'
)

// 在表达式中去除字符串
const stripStringRE =
  /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g

// 检测模板中有问题的表达式
export function detectErrors(ast: ASTNode | undefined, warn: Function) {
  if (ast) {
    checkNode(ast, warn)
  }
}

function checkNode(node: ASTNode, warn: Function) {
  if (node.type === 1) {
    for (const name in node.attrsMap) {
      if (dirRE.test(name)) {
        const value = node.attrsMap[name]
        if (value) {
          const range = node.rawAttrsMap[name]
          if (name === 'v-for') {
            checkFor(node, `v-for="${value}"`, warn, range)
          } else if (name === 'v-slot' || name[0] === '#') {
            checkFunctionParameterExpression(
              value,
              `${name}="${value}"`,
              warn,
              range
            )
          } else if (onRE.test(name)) {
            checkEvent(value, `${name}="${value}"`, warn, range)
          } else {
            checkExpression(value, `${name}="${value}"`, warn, range)
          }
        }
      }
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        checkNode(node.children[i], warn)
      }
    }
  } else if (node.type === 2) {
    checkExpression(node.expression, node.text, warn, node)
  }
}

function checkEvent(exp: string, text: string, warn: Function, range?: Range) {
  const stripped = exp.replace(stripStringRE, '')
  const keywordMatch: any = stripped.match(unaryOperatorsRE)
  if (keywordMatch && stripped.charAt(keywordMatch.index - 1) !== '$') {
    warn(
      `avoid using JavaScript unary operator as property name: ` +
        `"${keywordMatch[0]}" in expression ${text.trim()}`,
      range
    )
  }
  checkExpression(exp, text, warn, range)
}

function checkFor(
  node: ASTElement,
  text: string,
  warn: Function,
  range?: Range
) {
  checkExpression(node.for || '', text, warn, range)
  checkIdentifier(node.alias, 'v-for alias', text, warn, range)
  checkIdentifier(node.iterator1, 'v-for iterator', text, warn, range)
  checkIdentifier(node.iterator2, 'v-for iterator', text, warn, range)
}

function checkIdentifier(
  ident: string | null | undefined,
  type: string,
  text: string,
  warn: Function,
  range?: Range
) {
  if (typeof ident === 'string') {
    try {
      new Function(`var ${ident}=_`)
    } catch (e: any) {
      warn(`invalid ${type} "${ident}" in expression: ${text.trim()}`, range)
    }
  }
}

function checkExpression(
  exp: string,
  text: string,
  warn: Function,
  range?: Range
) {
  try {
    new Function(`return ${exp}`)
  } catch (e: any) {
    const keywordMatch = exp
      .replace(stripStringRE, '')
      .match(prohibitedKeywordRE)
    if (keywordMatch) {
      warn(
        `avoid using JavaScript keyword as property name: ` +
          `"${keywordMatch[0]}"\n  Raw expression: ${text.trim()}`,
        range
      )
    } else {
      warn(
        `invalid expression: ${e.message} in\n\n` +
          `    ${exp}\n\n` +
          `  Raw expression: ${text.trim()}\n`,
        range
      )
    }
  }
}

function checkFunctionParameterExpression(
  exp: string,
  text: string,
  warn: Function,
  range?: Range
) {
  try {
    new Function(exp, '')
  } catch (e: any) {
    warn(
      `invalid function parameter expression: ${e.message} in\n\n` +
        `    ${exp}\n\n` +
        `  Raw expression: ${text.trim()}\n`,
      range
    )
  }
}
