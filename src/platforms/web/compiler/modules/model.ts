/**
 * 使用动态类型绑定将 input[v-model] 扩展到 v-if-else 链中
 * 转这个：
 *   <input v-model=“data[type]” ：type=“type”>
 * 变成这样：
 *   <input v-if=“type === 'checkbox'” type=“checkbox” v-model=“data[type]”>
 *   <input v-else-if=“type === 'radio'” type=“radio” v-model=“data[type]”>
 *   <input v-else ：type=“type” v-model=“data[type]”>
 */

import { addRawAttr, getBindingAttr, getAndRemoveAttr } from 'compiler/helpers'

import {
  processFor,
  processElement,
  addIfCondition,
  createASTElement
} from 'compiler/parser/index'
import { ASTElement, CompilerOptions, ModuleOptions } from 'types/compiler'

function preTransformNode(el: ASTElement, options: CompilerOptions) {
  if (el.tag === 'input') {
    const map = el.attrsMap
    if (!map['v-model']) {
      return
    }

    let typeBinding
    if (map[':type'] || map['v-bind:type']) {
      typeBinding = getBindingAttr(el, 'type')
    }
    if (!map.type && !typeBinding && map['v-bind']) {
      typeBinding = `(${map['v-bind']}).type`
    }

    if (typeBinding) {
      const ifCondition = getAndRemoveAttr(el, 'v-if', true)
      const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``
      const hasElse = getAndRemoveAttr(el, 'v-else', true) != null
      const elseIfCondition = getAndRemoveAttr(el, 'v-else-if', true)
      // 1. 复选框
      const branch0 = cloneASTElement(el)
      // 主节点上的进程
      processFor(branch0)
      addRawAttr(branch0, 'type', 'checkbox')
      processElement(branch0, options)
      branch0.processed = true // 防止 IT 重复加工
      branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra
      addIfCondition(branch0, {
        exp: branch0.if,
        block: branch0
      })
      // 2. 添加单选 Else-If 条件
      const branch1 = cloneASTElement(el)
      getAndRemoveAttr(branch1, 'v-for', true)
      addRawAttr(branch1, 'type', 'radio')
      processElement(branch1, options)
      addIfCondition(branch0, {
        exp: `(${typeBinding})==='radio'` + ifConditionExtra,
        block: branch1
      })
      // 3. 其他
      const branch2 = cloneASTElement(el)
      getAndRemoveAttr(branch2, 'v-for', true)
      addRawAttr(branch2, ':type', typeBinding)
      processElement(branch2, options)
      addIfCondition(branch0, {
        exp: ifCondition!,
        block: branch2
      })

      if (hasElse) {
        branch0.else = true
      } else if (elseIfCondition) {
        branch0.elseif = elseIfCondition
      }

      return branch0
    }
  }
}

function cloneASTElement(el) {
  return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}

export default {
  preTransformNode
} as ModuleOptions
