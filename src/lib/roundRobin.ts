export function generateRoundRobinPairs<T>(items: T[]): [T, T][] {
  const pairs: [T, T][] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]])
    }
  }
  return pairs
}

export function groupLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    if (i < 26) return String.fromCharCode(65 + i)
    return `G${i + 1}`
  })
}
