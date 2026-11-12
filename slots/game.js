import { SHELL_PAIR, START_CREDITS, STAKES, SYMBOLS, WEIGHT, spin, symbol } from './rules.js'
import { drawSymbol } from './art.js'

const get = id => document.getElementById(id)
const stake = get('stake')
const spinButton = get('spin')
const reset = get('reset')
const result = get('result')
const reels = [...document.querySelectorAll('.reel')]
const storageKey = 'surfingcoder-slots-v1'
const openingReels = ['wave', 'sunset', 'board']
const format = new Intl.NumberFormat()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let state = { balance: START_CREDITS, best: START_CREDITS, reels: openingReels }
let spinning = false
let sound = false
let audio

try {
  const stored = JSON.parse(localStorage.getItem(storageKey))
  if (stored && [stored.balance, stored.best].every(value => Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER - 500)
      && stored.best >= stored.balance && Array.isArray(stored.reels) && stored.reels.length === 3 && stored.reels.every(symbol)) {
    state = stored
  }
} catch { /* The game can run without browser storage. */ }

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)) } catch { /* Storage is optional. */ }
}

function tone(frequency, length = .1) {
  if (!sound || audio?.state !== 'running') return
  const voice = audio.createOscillator()
  const volume = audio.createGain()
  const now = audio.currentTime
  voice.type = 'triangle'
  voice.frequency.value = frequency
  volume.gain.setValueAtTime(.08, now)
  volume.gain.exponentialRampToValueAtTime(.0001, now + length)
  voice.connect(volume).connect(audio.destination)
  voice.start(now)
  voice.stop(now + length)
}

function showReel(index, id, matched = false, animate = false) {
  const reel = reels[index]
  const name = symbol(id).name
  drawSymbol(reel.querySelector('canvas'), id, animate ? null : name)
  reel.querySelector('span').textContent = animate ? 'Spinning…' : name
  reel.classList.toggle('winner', matched)
}

function update() {
  get('credits').textContent = format.format(state.balance)
  get('best').textContent = format.format(state.best)
  for (const option of stake.options) option.disabled = Number(option.value) > state.balance
  const selected = Number(stake.value)
  if (!STAKES.includes(selected) || selected > state.balance) stake.value = '1'
  spinButton.disabled = spinning || state.balance === 0
  reset.disabled = spinning
  stake.disabled = spinning || state.balance === 0
}

function addRow(list, label, value) {
  const row = document.createElement('li')
  const name = document.createElement('span')
  const amount = document.createElement('strong')
  name.textContent = label
  amount.textContent = value
  row.append(name, amount)
  list.append(row)
}

for (const item of [...SYMBOLS].reverse()) addRow(get('payouts'), `${item.name} × 3`, `${item.payout}×`)
addRow(get('payouts'), 'Shell × 2', `${SHELL_PAIR}×`)
for (const item of SYMBOLS) addRow(get('odds'), item.name, `${item.weight} / ${WEIGHT}`)

async function play() {
  if (spinning) return
  const outcome = spin(state.balance, Number(stake.value))
  if (!outcome) return
  spinning = true
  state = { balance: outcome.balance, best: Math.max(state.best, outcome.balance), reels: outcome.reels }
  save()
  result.textContent = 'Spinning…'
  spinButton.disabled = reset.disabled = stake.disabled = true
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  await Promise.all(outcome.reels.map(async (id, index) => {
    if (!reduceMotion) {
      for (let step = 0; step < 8 + index * 3; step++) {
        showReel(index, SYMBOLS[(step + index) % SYMBOLS.length].id, false, true)
        await delay(58)
      }
    }
    showReel(index, id, outcome.match.includes(index))
    if (!reduceMotion) tone(295 + index * 58)
  }))
  spinning = false
  const message = outcome.payout
    ? `${outcome.label}. Pays ${format.format(outcome.payout)} credits.`
    : 'No match.'
  result.textContent = state.balance ? message : `${message} Reset credits to play again.`
  if (outcome.payout) tone(660, .24)
  update()
}

spinButton.addEventListener('click', play)
reset.addEventListener('click', () => {
  if (spinning) return
  state = { balance: START_CREDITS, best: state.best, reels: openingReels }
  save()
  stake.value = '1'
  state.reels.forEach((id, index) => showReel(index, id))
  result.textContent = 'Credits reset. Choose your stake and spin.'
  update()
})
window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest?.('a, button, select, input, textarea, summary, [contenteditable]')) return
  event.preventDefault()
  play()
})
get('sound').addEventListener('click', async () => {
  if (!sound) {
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) return
    try {
      audio ??= new Audio()
      await audio.resume()
      sound = true
    } catch { return }
  } else sound = false
  get('sound').textContent = sound ? 'Sound on' : 'Sound off'
  get('sound').setAttribute('aria-pressed', String(sound))
  tone(440)
})

state.reels.forEach((id, index) => showReel(index, id))
if (!state.balance) result.textContent = 'Reset credits to play again.'
update()
