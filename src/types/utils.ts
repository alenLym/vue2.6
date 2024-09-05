// 如果类型 T 接受类型 “any”，则输出类型 Y，否则输出类型 N。
// https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N
