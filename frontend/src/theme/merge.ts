type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export type { DeepPartial }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge<T>(base: T, overrides: DeepPartial<T>): T {
  const result = { ...base } as any
  for (const key of Object.keys(overrides as any)) {
    const val = (overrides as any)[key]
    if (val !== undefined && typeof val === 'object' && val !== null && !Array.isArray(val)) {
      result[key] = deepMerge((base as any)[key], val)
    } else if (val !== undefined) {
      result[key] = val
    }
  }
  return result as T
}
