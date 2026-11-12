export const START_CREDITS = 100
export const STAKES = [1, 5, 10]
export const SYMBOLS = [
  { id: 'shell', name: 'Shell', weight: 4, payout: 10 },
  { id: 'wave', name: 'Wave', weight: 4, payout: 12 },
  { id: 'sunset', name: 'Sunset', weight: 3, payout: 16 },
  { id: 'board', name: 'Surfboard', weight: 3, payout: 20 },
  { id: 'palm', name: 'Palm', weight: 2, payout: 30 },
  { id: 'pearl', name: 'Pearl', weight: 2, payout: 50 },
]
export const WEIGHT = SYMBOLS.reduce((total, item) => total + item.weight, 0)
export const SHELL_PAIR = 2
export const symbol = id => SYMBOLS.find(item => item.id === id)

function draw(random) {
  let roll = random() * WEIGHT
  for (const item of SYMBOLS) {
    if (roll < item.weight) return item.id
    roll -= item.weight
  }
  throw new RangeError('Random values must be below one')
}

export function evaluate(reels) {
  if (reels.every(id => id === reels[0])) {
    const item = symbol(reels[0])
    return { multiplier: item.payout, match: [0, 1, 2], label: `Three ${item.name.toLowerCase()} symbols` }
  }
  const shells = reels.flatMap((id, index) => id === 'shell' ? [index] : [])
  if (shells.length === 2) return { multiplier: SHELL_PAIR, match: shells, label: 'Two shells' }
  return { multiplier: 0, match: [], label: 'No match' }
}

export function spin(balance, stake, random = Math.random) {
  if (!STAKES.includes(stake) || !Number.isSafeInteger(balance) || balance < stake) return null
  const reels = Array.from({ length: 3 }, () => draw(random))
  const outcome = evaluate(reels)
  const payout = stake * outcome.multiplier
  return { ...outcome, reels, payout, balance: balance - stake + payout }
}
