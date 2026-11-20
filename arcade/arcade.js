import {createGame, stageName, update} from './patrol.js?v=20261120-single-surfer'
import {drawPatrol} from './patrol-art.js?v=20261120-single-surfer'

const $ = id => document.getElementById(id)
const ctx = $('playfield').getContext('2d')
const pad = (number, length = 6) => String(number).padStart(length, '0')
const held = new Set()
const buttons = new Set()
const pointer = new Map()
const keys = {ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'throw'}
const sounds = {throw: [630, 310, .08], hit: [180, 105, .095],
  damage: [150, 52, .25], wave: [420, 780, .3], shell: [760, 1150, .14]}
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const scoreKey = 'barrel-patrol-best'
let game = createGame(), mode = 'ready', audio, sound = true
let previous = 0, accumulator = 0

let best = 0
try { best = Number(localStorage.getItem(scoreKey)) || 0 } catch {}

function text(id, value) {
  const element = $(id), next = String(value)
  if (element.textContent !== next) element.textContent = next
}

function format() {
  if (game.score > best) {
    best = game.score
    try { localStorage.setItem(scoreKey, String(best)) } catch {}
  }
  text('score', pad(game.score))
  text('best', pad(best))
  text('wave', pad(game.wave, 2))
  text('lives', game.lives)
  text('stage-title', stageName(game.wave))
  $('stage-line').classList.toggle('bonus', game.stage === 'bonus')
  text('stage-objective', game.stage === 'bonus' ? game.shells + ' / 21 shells' : 'Reef break')
}

function clearInput() {
  held.clear()
  buttons.clear()
  pointer.clear()
}

function setMode(next) {
  mode = next
  $('overlay').hidden = next === 'playing'
  $('pause').disabled = next !== 'playing' && next !== 'paused'
  $('pause').textContent = next === 'paused' ? 'Resume' : 'Pause'
  $('prompt').textContent = {ready: 'Sets are rolling in', paused: 'Paused', over: 'Wipeout · ' + pad(game.score) + ' points'}[next] ?? ''
  $('launch').textContent = {ready: 'Play Barrel Patrol', paused: 'Resume game', over: 'Ride again'}[next] ?? ''
  clearInput()
  accumulator = 0
  if (next === 'paused' || next === 'over') $('launch').focus({preventScroll: true})
}

function begin() {
  if (mode !== 'paused') game = createGame()
  if (sound) enableAudio()
  setMode('playing')
  format()
  $('playfield').focus({preventScroll: true})
}

function togglePause() {
  if (mode === 'playing') setMode('paused')
  else if (mode === 'paused') begin()
}

function enableAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') audio.resume().catch(() => {})
  } catch {}
}

function beep(event) {
  if (!sound || audio?.state !== 'running') return
  const [start, end, length] = sounds[event]
  const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime
  osc.type = ['wave', 'shell', 'throw'].includes(event) ? 'triangle' : 'sine'
  osc.frequency.setValueAtTime(start, now)
  osc.frequency.exponentialRampToValueAtTime(end, now + length)
  gain.gain.setValueAtTime(event === 'throw' ? .025 : .044, now)
  gain.gain.exponentialRampToValueAtTime(.0004, now + length)
  osc.connect(gain).connect(audio.destination)
  osc.start()
  osc.stop(now + length)
}

function loop(now) {
  const dt = Math.min(.05, (now - previous) / 1000)
  previous = now
  if (mode === 'playing') {
    accumulator += dt
    const active = new Set([...held].map(code => keys[code]))
    for (const action of [...buttons, ...pointer.values()]) active.add(action)
    const input = {
      direction: Number(active.has('right')) - Number(active.has('left')),
      fire: active.has('throw'),
    }
    while (accumulator >= 1 / 120 && !game.over) {
      update(game, input, 1 / 120).forEach(beep)
      accumulator -= 1 / 120
    }
    format()
    if (game.over) setMode('over')
  }
  drawPatrol(ctx, game, reduced.matches)
  requestAnimationFrame(loop)
}

$('launch').addEventListener('click', begin)
$('pause').addEventListener('click', togglePause)
$('sound').addEventListener('click', () => {
  sound = !sound
  if (sound) enableAudio()
  $('sound').setAttribute('aria-pressed', String(sound))
  $('sound').textContent = sound ? 'Sound on' : 'Sound off'
})
window.addEventListener('keydown', event => {
  if ($('rom-dialog').open || event.ctrlKey || event.metaKey || event.altKey) return
  if (['KeyP', 'Escape'].includes(event.code) && !event.repeat) togglePause()
  if (event.target.closest?.('select,input,a,button')) return
  if (mode !== 'playing' || !keys[event.code]) return
  event.preventDefault()
  held.add(event.code)
})
window.addEventListener('keyup', event => held.delete(event.code))
window.addEventListener('blur', clearInput)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') setMode('paused')
})
for (const control of document.querySelectorAll('[data-hold]')) {
  control.addEventListener('pointerdown', event => {
    if (mode !== 'playing') return
    event.preventDefault()
    control.setPointerCapture(event.pointerId)
    pointer.set(event.pointerId, control.dataset.hold)
  })
  for (const action of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    control.addEventListener(action, event => pointer.delete(event.pointerId))
  }
  control.addEventListener('keydown', event => {
    if (mode !== 'playing' || !['Space', 'Enter'].includes(event.code)) return
    event.preventDefault()
    buttons.add(control.dataset.hold)
  })
  control.addEventListener('keyup', () => buttons.delete(control.dataset.hold))
  control.addEventListener('blur', () => buttons.delete(control.dataset.hold))
}

document.addEventListener('arcade:open-rom', () => {
  if (mode === 'playing') setMode('paused')
})

setMode('ready')
format()
drawPatrol(ctx, game, reduced.matches)
requestAnimationFrame(loop)
