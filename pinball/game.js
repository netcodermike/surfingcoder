import { advance, createGame, serve, STEP } from './physics.js'
import { makeTable, render } from './art.js'

const byId = id => document.getElementById(id)
const canvas = byId('table')
const ctx = canvas.getContext('2d')
const table = makeTable()
const highScoreKey = 'surfingcoder-pinball-best'
const format = new Intl.NumberFormat()
const tones = { launch: [196, 392], bumper: [440, 620], lane: [660, 880],
  set: [523, 659, 784], drain: [170, 110], sling: [285], flip: [135] }
const keyboard = new Set()
const pointers = { left: new Set(), right: new Set(), launch: new Set() }
const keys = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], launch: ['Space'] }
let storedBest = 0
try { storedBest = Math.max(0, Number(localStorage.getItem(highScoreKey)) || 0) } catch { /* Storage is optional. */ }
let game = createGame(storedBest)
let paused = false
let audio
let sound = false
let last = performance.now()
let remainder = 0
let previousHud = ''

function controls() {
  return Object.fromEntries(Object.entries(keys).map(([action, codes]) =>
    [action, pointers[action].size > 0 || codes.some(code => keyboard.has(code))]))
}

function play(name) {
  if (!sound || audio?.state !== 'running') return
  for (const [index, frequency] of (tones[name] ?? []).entries()) {
    const voice = audio.createOscillator()
    const envelope = audio.createGain()
    const at = audio.currentTime + index * .045
    voice.frequency.value = frequency
    voice.type = name === 'flip' ? 'triangle' : 'sine'
    envelope.gain.setValueAtTime(.0001, at)
    envelope.gain.exponentialRampToValueAtTime(.12, at + .015)
    envelope.gain.exponentialRampToValueAtTime(.0001, at + .15)
    voice.connect(envelope).connect(audio.destination)
    voice.start(at)
    voice.stop(at + .16)
  }
}

function launch() {
  if (!paused && !controls().launch && serve(game)) play('launch')
}

function hud() {
  const input = controls()
  for (const action of Object.keys(input)) byId(action).classList.toggle('active', input[action] && !paused)
  const state = JSON.stringify([game.score, game.best, game.number, game.mode, game.lit, game.message, paused])
  if (state === previousHud) return
  previousHud = state
  byId('score').textContent = format.format(game.score)
  byId('best').textContent = format.format(game.best)
  byId('ball-number').textContent = `${game.number} / 3`
  byId('message').textContent = paused ? 'Paused. Press P or Resume.' : game.message
  byId('launch').disabled = paused || game.mode !== 'ready'
  byId('pause').textContent = paused ? 'Resume' : 'Pause'
  byId('pause').setAttribute('aria-pressed', String(paused))
  const lamps = byId('wave-lamps')
  lamps.setAttribute('aria-label', `${game.lit.filter(Boolean).length} of 3 wave bumpers lit`)
  ;[...lamps.children].forEach((lamp, i) => lamp.classList.toggle('lit', game.lit[i]))
  if (game.best > storedBest) {
    storedBest = game.best
    try { localStorage.setItem(highScoreKey, String(storedBest)) } catch { /* Storage is optional. */ }
  }
}

function clearInputs() {
  keyboard.clear()
  for (const held of Object.values(pointers)) held.clear()
  if (game.mode === 'ready') game.charge = 0
}

function togglePause() {
  paused = !paused
  clearInputs()
  hud()
}

for (const [action, held] of Object.entries(pointers)) {
  const button = byId(action)
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || paused) return
    held.add(event.pointerId)
    button.setPointerCapture(event.pointerId)
  })
  button.addEventListener('pointerup', event => {
    if (held.delete(event.pointerId) && action === 'launch') launch()
  })
  for (const name of ['pointercancel', 'lostpointercapture']) {
    button.addEventListener(name, event => {
      if (held.delete(event.pointerId) && action === 'launch') game.charge = 0
    })
  }
  if (action === 'launch') button.addEventListener('click', event => {
    if (event.detail === 0) launch()
  })
}

window.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (event.code === 'KeyP' && !event.repeat) togglePause()
  if (!Object.values(keys).some(codes => codes.includes(event.code))) return
  if (event.code === 'Space' && event.target.closest?.('button:not(#launch), a')) return
  event.preventDefault()
  if (!paused) keyboard.add(event.code)
})
window.addEventListener('keyup', event => {
  if (keyboard.delete(event.code) && event.code === 'Space') launch()
})
window.addEventListener('blur', () => {
  clearInputs()
  if (game.mode === 'play' && !paused) togglePause()
})
byId('pause').addEventListener('click', togglePause)
byId('restart').addEventListener('click', () => {
  clearInputs()
  game = createGame(storedBest)
  paused = false
  byId('restart').blur()
  hud()
})
byId('sound').addEventListener('click', async () => {
  if (!sound) {
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) return
    try {
      audio ??= new Audio()
      await audio.resume()
      sound = true
    } catch { return }
  } else sound = false
  byId('sound').textContent = sound ? 'Sound on' : 'Sound off'
  byId('sound').setAttribute('aria-pressed', String(sound))
  if (sound) play('bumper')
})

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000)
  last = now
  if (!paused) {
    remainder += dt
    const input = controls()
    while (remainder >= STEP) {
      advance(game, input)
      remainder -= STEP
    }
    for (const event of game.effects.splice(0)) play(event)
  }
  render(ctx, table, game, paused)
  hud()
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
