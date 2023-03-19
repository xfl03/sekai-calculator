export function findOrThrow<T> (arr: T[], p: (t: T) => boolean): T {
  const result = arr.find(p)
  if (result === undefined) throw new Error('object not found')
  return result
}
export function getOrThrow<K, V> (map: Map<K, V>, key: K): V {
  const value = map.get(key)
  if (value === undefined) throw new Error('key not found')
  return value
}
export function getOrDefault<K, V> (map: Map<K, V>, key: K, defaultValue: V): V {
  const value = map.get(key)
  if (value === undefined) return defaultValue
  return value
}

export function computeWithDefault<K, V> (map: Map<K, V>, key: K, defaultValue: V, action: (v: V) => V): void {
  map.set(key, action(getOrDefault(map, key, defaultValue)))
}
