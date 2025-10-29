/**
 * Converts a string from snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Recursively converts all keys in an object from snake_case to camelCase
 */
export function convertKeysToCamelCase<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToCamelCase(item)) as T
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = snakeToCamel(key)
        result[camelKey] = convertKeysToCamelCase(obj[key])
      }
    }
    return result as T
  }

  return obj
}
