export function hasChars(value: unknown, length = 1): value is string {
  if (typeof value != "string") return false
  let chars = value.match(/\S/g)
  return chars ? chars.length >= length : false
}
