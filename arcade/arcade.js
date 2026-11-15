import {createGame,update,WIDTH,HEIGHT,SHIP_Y} from './patrol.js'

const $ = id => document.getElementById(id)
const ctx = $('playfield').getContext('2d')
const pad = (n, length=6) => String(n).padStart(length,'0')
const held = new Set()
const pointer = new Map()
const keys = {ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'fire'}
const colors = ['#ffd094','#fc9fda','#b3a0ff','#8df8e0']
const sprites = [
  ['001000100','000101000','011111110','110111011','111111111','101010101','001000100'],
  ['000111000','101111101','111111111','011010110','111111111','001101100','010000010'],
  ['001111100','110101011','111111111','011111110','010010010','100000001'],
  ['010000010','001111100','111111111','110101011','111111111','010000010'],
]
const shipSprite = ['00000100000','00001110000','00001110000','10011111001','11111111111','01111111110','00111011100','00100000100']
const sky = ctx.createLinearGradient(0,0,0,HEIGHT)
sky.addColorStop(0,'#0c1026');sky.addColorStop(.6,'#1b1540');sky.addColorStop(1,'#0b2938')
const stars = Array.from({length:81},(_,i) => ({
  x:(i*127+23)%WIDTH,y:(i*i*53+17)%HEIGHT,size:i%9===0?2:1,speed:8+i%16
}))
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
let game = createGame(), mode = 'ready', audio, sound = false, best = 0
let previous = 0, accumulator = 0
try { best = Number(localStorage.getItem('barrel-patrol-best')) || 0 } catch {}
const format = () => {
  if (game.score > best) {
    best = game.score
    try { localStorage.setItem('barrel-patrol-best',String(best)) } catch {}
  }
  $('score').textContent = pad(game.score)
  $('best').textContent = pad(best)
  $('wave').textContent = pad(game.wave,2)
  $('lives').textContent = game.lives
}
function setMode(next) {
  mode = next
  $('overlay').hidden = next === 'playing'
  $('pause').disabled = next !== 'playing' && next !== 'paused'
  $('pause').textContent = next === 'paused' ? 'Resume' : 'Pause'
  $('prompt').textContent = {ready:'Ready to launch?',paused:'Paused',over:'Game over · '+pad(game.score)+' points'}[next] ?? ''
  $('launch').textContent = {ready:'Play Barrel Patrol',paused:'Resume game',over:'Play again'}[next] ?? ''
  held.clear()
  pointer.clear()
  accumulator = 0
  if (next === 'paused' || next === 'over') $('launch').focus({preventScroll:true})
}
function begin() {
  if (mode !== 'paused') game = createGame()
  if (sound) enableAudio()
  setMode('playing')
  format()
  $('playfield').tabIndex = -1
  $('playfield').focus({preventScroll:true})
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
  const [high,low,length] = {fire:[520,220,.09],hit:[180,105,.095],damage:[150,52,.25],wave:[420,780,.3]}[event]
  const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime
  osc.type = event === 'wave' ? 'triangle' : 'square'
  osc.frequency.setValueAtTime(high,now)
  osc.frequency.exponentialRampToValueAtTime(low,now+length)
  gain.gain.setValueAtTime(event === 'fire' ? .021 : .043,now)
  gain.gain.exponentialRampToValueAtTime(.0004,now+length)
  osc.connect(gain);gain.connect(audio.destination)
  osc.start();osc.stop(now+length)
}
function sprite(pattern,x,y,unit,color) {
  ctx.fillStyle = color
  const startX = Math.round(x-pattern[0].length*unit/2), startY = Math.round(y-pattern.length*unit/2)
  pattern.forEach((line,row) => [...line].forEach((bit,col) => {
    if (bit === '1') ctx.fillRect(startX+col*unit,startY+row*unit,unit,unit)
  }))
}
function draw() {
  const clock = reduced.matches ? 0 : game.clock
  ctx.fillStyle = sky;ctx.fillRect(0,0,WIDTH,HEIGHT)
  for (const star of stars) {
    ctx.fillStyle = star.size === 2 ? '#d6bffc95' : '#baa7db4b'
    ctx.fillRect(star.x,(star.y+clock*star.speed)%HEIGHT,star.size,star.size)
  }
  const glow = ctx.createRadialGradient(240,494,0,240,494,208)
  glow.addColorStop(0,'#2ce6da43');glow.addColorStop(1,'#2ce6da00')
  ctx.fillStyle = glow;ctx.fillRect(0,300,WIDTH,250)
  for (let i=0;i<6;i++) {
    ctx.beginPath();ctx.moveTo(0,HEIGHT-12-i*11)
    for (let x=0;x<=WIDTH;x+=8) {
      ctx.lineTo(x,HEIGHT-12-i*11+Math.sin(x/46+i*.46+clock*.92)*(8+i))
    }
    ctx.strokeStyle = i % 2 ? '#55e4d536' : '#b2a1fd2b'
    ctx.lineWidth = 1+i*.1;ctx.stroke()
  }
  for (const foe of game.foes) {
    const color = colors[foe.row]
    if (foe.dive) {
      ctx.fillStyle = '#ffc48b4d';ctx.fillRect(foe.x-2,foe.y-27,4,15)
    }
    sprite(sprites[foe.row],foe.x,foe.y,3,color)
  }
  ctx.fillStyle = '#ccffec'
  for (const shot of game.shots) ctx.fillRect(shot.x-1,shot.y-6,3,13)
  ctx.fillStyle = '#ff8db6'
  for (const shot of game.enemyShots) ctx.fillRect(shot.x-2,shot.y-4,4,10)
  if (game.lives && (reduced.matches || !game.shield || Math.floor(game.shield*11)%2===0)) {
    const {x} = game.ship
    ctx.fillStyle = '#62ede442';ctx.fillRect(x-13,SHIP_Y+8,26,19)
    sprite(shipSprite,x,SHIP_Y,3,'#adffec')
    ctx.fillStyle = '#f8c48e';ctx.fillRect(x-2,SHIP_Y-4,4,7)
    ctx.fillRect(x-3,SHIP_Y+12,6,8)
  }
  for (const spark of game.sparks) {
    ctx.globalAlpha = Math.min(1,spark.life*3);ctx.fillStyle = spark.color
    ctx.fillRect(spark.x,spark.y,3,3)
  }
  ctx.globalAlpha = 1
  if (game.intermission && !game.over) {
    ctx.fillStyle = '#b8ffee';ctx.font = 'bold 26px system-ui';ctx.textAlign = 'center'
    ctx.fillText('Wave cleared',WIDTH/2,HEIGHT/2)
  }
}
function loop(now) {
  const dt = Math.min(.05,(now-previous)/1000)
  previous = now
  if (mode === 'playing') {
    accumulator += dt
    const down = key => held.has(key) || [...pointer.values()].includes(key)
    const input = {direction:Number(down('right'))-Number(down('left')),fire:down('fire')}
    while (accumulator >= 1/120 && !game.over) {
      update(game,input,1/120).forEach(beep)
      accumulator -= 1/120
    }
    format()
    if (game.over) setMode('over')
  }
  draw()
  requestAnimationFrame(loop)
}
$('launch').addEventListener('click',begin)
$('pause').addEventListener('click',togglePause)
$('sound').addEventListener('click',() => {
  sound = !sound
  if (sound) enableAudio()
  $('sound').setAttribute('aria-pressed',String(sound))
  $('sound').textContent = sound ? 'Sound on' : 'Sound off'
})
window.addEventListener('keydown',event => {
  if ($('rom-dialog').open || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.target.closest('select,input,a,button')) return
  if (['KeyP','Escape'].includes(event.code) && !event.repeat) togglePause()
  if (mode !== 'playing' || !keys[event.code]) return
  event.preventDefault();held.add(keys[event.code])
})
window.addEventListener('keyup',event => held.delete(keys[event.code]))
window.addEventListener('blur',() => {held.clear();pointer.clear()})
document.addEventListener('visibilitychange',() => {
  if (document.hidden && mode === 'playing') setMode('paused')
})
for (const control of document.querySelectorAll('[data-hold]')) {
  control.addEventListener('pointerdown',event => {
    if (mode !== 'playing') return
    event.preventDefault();control.setPointerCapture(event.pointerId)
    pointer.set(event.pointerId,control.dataset.hold)
  })
  for (const action of ['pointerup','pointercancel','lostpointercapture']) {
    control.addEventListener(action,event => pointer.delete(event.pointerId))
  }
  control.addEventListener('keydown',event => {
    if (mode !== 'playing' || !['Space','Enter'].includes(event.code)) return
    event.preventDefault();held.add(control.dataset.hold)
  })
  control.addEventListener('keyup',() => held.delete(control.dataset.hold))
  control.addEventListener('blur',() => held.delete(control.dataset.hold))
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
setMode('ready');format();draw();requestAnimationFrame(loop)
