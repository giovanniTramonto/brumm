export function joinWithAnd(items: string[], conjunction = 'und'): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`
}
