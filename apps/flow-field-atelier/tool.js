import { random } from './art.js'

const palettes = {
  'Night bloom': ['#f5bb81','#dc6da8','#9f83fa','#7ddac9','#e4dca4'],
  'Northern lights': ['#71f1ca','#75b6ff','#99a3ff','#bf83f2','#d9fdb9'],
  'Ember': ['#f7c37c','#fc8366','#a75792','#f5e7ac','#f7a7aa'],
}

export function mount({ context, choice, range, button, detail }) {
  let seed = 184, particles = 950, curve = 65, palette = 'Night bloom'
  function draw() {
    const rand = random(seed)
    const backdrop = context.createLinearGradient(0,0,1000,640)
    backdrop.addColorStop(0,'#131726')
    backdrop.addColorStop(1,'#291930')
    context.fillStyle = backdrop
    context.fillRect(0,0,1000,640)
    context.lineWidth = 1.1
    for (let i = 0; i < particles; i++) {
      let x = 35 + rand() * 930, y = 30 + rand() * 580
      const steps = 11 + Math.floor(rand() * 28)
      const color = palettes[palette][Math.floor(rand() * 5)]
      context.strokeStyle = color + (i % 7 === 0 ? 'd8' : '53')
      context.beginPath()
      context.moveTo(x,y)
      for (let j = 0; j < steps; j++) {
        const angle = Math.sin(x / 160 + y / 200) * curve / 20 + Math.cos(y / 97 - x / 270) * 1.6 + seed * .034
        x += Math.cos(angle) * 3.5
        y += Math.sin(angle) * 3.5
        context.lineTo(x,y)
      }
      context.stroke()
    }
    detail(`Seed ${seed} · ${particles} paths`)
  }
  const seeds = range('Seed',1,999,seed,value => { seed = value; draw() })
  range('Path count',150,1600,particles,value => { particles = value; draw() }, 50)
  range('Curvature',0,100,curve,value => { curve = value; draw() })
  choice('Palette',Object.keys(palettes),palette,value => { palette = value; draw() })
  button('Next seed', () => {
    seeds.value = seed % 999 + 1
    seeds.dispatchEvent(new Event('input'))
  })
  draw()
  return ({ update, assert }) => {
    update(seeds, 435)
    assert(seed === 435, 'Seed was not updated')
  }
}
