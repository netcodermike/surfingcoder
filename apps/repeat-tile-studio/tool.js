import { polygon } from './art.js'

export function mount({ context, surface, choice, range, color, detail, exportAs }) {
  let motif = 'Petals', repeats = 4, turn = 18, ink = '#ffbe83', ground = '#28314d'
  const tile = surface(360, 360)
  const ctx = tile.getContext('2d')
  function mark(x, y, size, secondary) {
    ctx.save()
    ctx.translate(x,y)
    ctx.rotate(turn * Math.PI / 180)
    const fill = secondary ? '#83dcc3' : ink
    if (motif === 'Diamonds') {
      polygon(ctx, fill, [[0,-size], [size*.53,0], [0,size], [-size*.53,0]])
      polygon(ctx, ground, [[0,-size*.45], [size*.25,0], [0,size*.45], [-size*.25,0]])
    } else if (motif === 'Arches') {
      ctx.lineWidth = size * .12
      ctx.strokeStyle = fill
      for (const radius of [.35,.58,.82,1]) {
        ctx.beginPath()
        ctx.arc(0, 12, size * radius, Math.PI, 0)
        ctx.stroke()
      }
    } else {
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2)
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.ellipse(0, size * .56, size * .21, size * .46, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#faf0be'
      ctx.beginPath(); ctx.arc(0,0,size*.12,0,Math.PI*2); ctx.fill()
    }
    ctx.restore()
  }
  function draw() {
    ctx.fillStyle = ground
    ctx.fillRect(0,0,360,360)
    for (const x of [0,360]) for (const y of [0,360]) mark(x,y,94,true)
    mark(180,180,112,false)
    ctx.fillStyle = '#f8eac188'
    for (const x of [90,270]) for (const y of [90,270]) {
      ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill()
    }
    const size = 1000 / repeats
    context.fillStyle = ground
    context.fillRect(0,0,1000,640)
    for (let x = 0; x < 1000; x += size) for (let y = 0; y < 640; y += size) context.drawImage(tile,x,y,size,size)
    detail(`${repeats} tiles across · 360 × 360 px master`)
  }
  const kind = choice('Motif', ['Petals','Diamonds','Arches'], motif, value => { motif = value; draw() })
  range('Repeats across', 2, 8, repeats, value => { repeats = value; draw() })
  range('Motif rotation', 0, 90, turn, value => { turn = value; draw() })
  color('Motif color', ink, value => { ink = value; draw() })
  color('Background', ground, value => { ground = value; draw() })
  exportAs(() => tile)
  draw()
  return ({ update, assert }) => {
    update(kind, 'Arches')
    assert(tile.width === 360 && motif === 'Arches', 'Tile update failed')
  }
}
