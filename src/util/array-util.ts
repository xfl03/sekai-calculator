export function findOrThrow<T> (arr: T[], p: (t: T) => boolean): T {
  const result = arr.find(p)
  if (result === undefined) throw new Error('object not found')
  return result
}
