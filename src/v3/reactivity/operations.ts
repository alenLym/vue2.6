// 使用文本字符串而不是数字，以便于检查
// 调试器事件

export const enum TrackOpTypes {
  GET = 'get',
  TOUCH = 'touch'
}

export const enum TriggerOpTypes {
  SET = 'set',
  ADD = 'add',
  DELETE = 'delete',
  ARRAY_MUTATION = 'array mutation'
}
