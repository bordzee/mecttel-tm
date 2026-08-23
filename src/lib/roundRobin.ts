export function generateRoundRobinPairs<T>(items: T[]): [T, T][] {
  const pairs: [T, T][] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]])
    }
  }
  return pairs
}

/** Circle-method round-robin rounds (each player plays once per round). */
export function generateRoundRobinRounds<T>(items: T[]): [T, T][][] {
  if (items.length < 2) return []

  const isOdd = items.length % 2 === 1
  const slots: (T | null)[] = isOdd ? [...items, null] : [...items]
  const rounds: [T, T][][] = []
  const count = slots.length
  const roundCount = count - 1

  for (let round = 0; round < roundCount; round++) {
    const pairs: [T, T][] = []
    for (let i = 0; i < count / 2; i++) {
      const home = slots[i]
      const away = slots[count - 1 - i]
      if (home != null && away != null) {
        pairs.push([home, away])
      }
    }
    rounds.push(pairs)

    const fixed = slots[0]
    const rotating = slots.slice(1)
    const last = rotating.pop()
    if (last !== undefined) rotating.unshift(last)
    slots.splice(0, slots.length, fixed, ...rotating)
  }

  return rounds
}

export function generateRoundRobinPairsOrdered<T>(
  items: T[],
): { entryA: T; entryB: T; queueOrder: number }[] {
  const rounds = generateRoundRobinRounds(items)
  const result: { entryA: T; entryB: T; queueOrder: number }[] = []
  let order = 0
  for (const round of rounds) {
    for (const [entryA, entryB] of round) {
      result.push({ entryA, entryB, queueOrder: order++ })
    }
  }
  return result
}

/** Round-robin queue position for a pair within a fixed member list. */
export function queueOrderForPair<T>(
  memberIds: T[],
  entryA: T,
  entryB: T,
): number {
  const ordered = generateRoundRobinPairsOrdered(memberIds)
  const found = ordered.find(
    (pair) =>
      (pair.entryA === entryA && pair.entryB === entryB) ||
      (pair.entryA === entryB && pair.entryB === entryA),
  )
  return found?.queueOrder ?? ordered.length
}

export function groupLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    if (i < 26) return String.fromCharCode(65 + i)
    return `G${i + 1}`
  })
}
