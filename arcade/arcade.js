import {createGame, stageName, update} from './patrol.js?v=20261120-surf'
import {drawPatrol} from './patrol-art.js?v=20261120-reef'

const $ = id => document.getElementById(id)
const ctx = $('playfield').getContext('2d')
const pad = (number, length = 6) => String(number).padStart(length, '0')
const held = new Set()
const buttons = new Set()
const pointer = new Map()
const soloKeys = {ArrowLeft: '1-left', KeyA: '1-left', ArrowRight: '1-right', KeyD: '1-right', Space: '1-throw'}
const coopKeys = {KeyA: '1-left', KeyD: '1-right', KeyF: '1-throw', Space: '1-throw',
  ArrowLeft: '2-left', ArrowRight: '2-right', Slash: '2-throw', Numpad0: '2-throw'}
const sounds = {throw: [630, 310, .08], hit: [180, 105, .095],
  damage: [150, 52, .25], wave: [420, 780, .3], shell: [760, 1150, .14]}
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const bestScores = new Map()
let game = createGame(), mode = 'ready', audio, sound = false
let previous = 0, accumulator = 0

function scoreKey() {
  return game.ride === 'solo' ? 'barrel-patrol-best' : 'barrel-patrol-best-' + game.ride
}

function text(id, value) {
  const element = $(id), next = String(value)
  if (element.textContent !== next) element.textContent = next
}

function format() {
  const key = scoreKey()
  if (!bestScores.has(key)) {
    let stored = 0
    try { stored = Number(localStorage.getItem(key)) || 0 } catch {}
    bestScores.set(key, stored)
  }
  if (game.score > bestScores.get(key)) {
    bestScores.set(key, game.score)
    try { localStorage.setItem(key, String(game.score)) } catch {}
  }
  text('score', pad(game.score))
  text('best', pad(bestScores.get(key)))
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
  $('ride').disabled = next === 'playing' || next === 'paused'
  $('pause').disabled = next !== 'playing' && next !== 'paused'
  $('pause').textContent = next === 'paused' ? 'Resume' : 'Pause'
  $('prompt').textContent = {ready: 'Sets are rolling in', paused: 'Paused', over: 'Wipeout · ' + pad(game.score) + ' points'}[next] ?? ''
  $('launch').textContent = {ready: 'Play Barrel Patrol', paused: 'Resume game', over: 'Ride again'}[next] ?? ''
  clearInput()
  accumulator = 0
  if (next === 'paused' || next === 'over') $('launch').focus({preventScroll: true})
}

function begin() {
  if (mode !== 'paused') game = createGame($('ride').value)
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
    const keys = game.ride === 'coop' ? coopKeys : soloKeys
    const active = new Set([...held].map(code => keys[code]))
    for (const action of [...buttons, ...pointer.values()]) active.add(action)
    const inputs = [1, 2].map(player => ({
      direction: Number(active.has(player + '-right')) - Number(active.has(player + '-left')),
      fire: active.has(player + '-throw'),
    }))
    while (accumulator >= 1 / 120 && !game.over) {
      update(game, inputs, 1 / 120).forEach(beep)
      accumulator -= 1 / 120
    }
    format()
    if (game.over) setMode('over')
  }
  drawPatrol(ctx, game, reduced.matches)
  requestAnimationFrame(loop)
}

function selectRide() {
  game = createGame($('ride').value)
  for (const section of document.querySelectorAll('[data-coop]')) section.hidden = game.ride !== 'coop'
  for (const section of document.querySelectorAll('[data-shared-controls]')) section.hidden = game.ride === 'coop'
  text('ride-help', {
    solo: 'One surfer. Steer with the arrows or A and D.',
    tandem: 'Two surfers throw together from the same controls.',
    coop: 'Two sets of controls. Both surfers share score and lives.',
  }[game.ride])
  setMode('ready')
  format()
}
$('ride').addEventListener('change', selectRide)
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
  const keys = game.ride === 'coop' ? coopKeys : soloKeys
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

const dialog = $('rom-dialog')
const fileInput = $('rom-file')
let frame, requested = 0
const parentOrigin = location.origin
document.querySelector('[for="rom-file"]').addEventListener('keydown',event => {
  if (!['Space','Enter'].includes(event.code)) return
  event.preventDefault()
  fileInput.click()
})
fileInput.addEventListener('change',async () => {
  const file = fileInput.files[0], selection = ++requested
  fileInput.value = ''
  if (!file) return
  $('rom-error').textContent = ''
  try {
    if (!/^[^/\\]+\.zip$/i.test(file.name) || file.size > 64*1024*1024 || file.size<22) {
      throw new Error('Choose an arcade ROM ZIP up to 64 MB.')
    }
    const signature = new Uint8Array(await file.slice(0,4).arrayBuffer())
    if (selection !== requested) return
    if (signature.join(',') !== '80,75,3,4') throw new Error('This file does not contain a ZIP archive.')
    if (mode === 'playing') setMode('paused')
    $('rom-filename').textContent = file.name
    frame = document.createElement('iframe')
    frame.title = 'MAME browser player'
    frame.allow = 'autoplay; fullscreen'
    const player = frame
    player.srcdoc = `<!doctype html><html lang="en"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>MAME Browser Player</title><link rel="stylesheet" href="./rom-player.css">
      <script src="./rom-player.js" defer></script></head><body>
      <main id="game" aria-label="Arcade emulator"></main>
      <p id="notice" role="status">Opening the emulator…</p></body></html>`
    player.addEventListener('load',() => {
      if (frame === player) player.contentWindow.postMessage({type:'play-local-rom',file},parentOrigin)
    },{once:true})
    $('rom-screen').replaceChildren(frame)
    dialog.showModal()
  } catch (error) {
    if (selection === requested) $('rom-error').textContent = error.message
  }
})
$('close-rom').addEventListener('click',() => dialog.close())
dialog.addEventListener('close',() => {
  frame?.remove();frame = null
  document.querySelector('[for="rom-file"]').focus()
})
selectRide()
drawPatrol(ctx, game, reduced.matches)
requestAnimationFrame(loop)
