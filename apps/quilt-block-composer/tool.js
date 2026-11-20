import { polygon } from './art.js'

const palettes = {
  'Sunset': ['#243553','#f4b074','#e87572','#f7e4b8'],
  'Tidepool': ['#17334c','#7fbdb1','#4f83ae','#e0e9be'],
  'Berry': ['#36224b','#b26fbc','#ef829e','#f9d6bc'],
}

export function mount({ context, surface, choice, range, button, pointer, detail, exportAs }) {
  let palette = 'Sunset', count = 6, cells = []
  const quilt = surface(600,600)
  const ctx = quilt.getContext('2d')
  function reset() {
    cells = Array.from({ length: count * count }, (_, index) => {
      const x = index % count, y = Math.floor(index / count)
      return (x < count / 2 ? 0 : 1) + (y < count / 2 ? 0 : 2) + (x + y) % 2
    })
    draw()
  }
  function draw() {
    const size = 600 / count
    cells.forEach((turn, index) => {
      const x = index % count, y = Math.floor(index / count)
      const colors = palettes[palette]
      ctx.save()
      ctx.translate((x + .5) * size, (y + .5) * size)
      ctx.rotate(turn * Math.PI / 2)
      ctx.fillStyle = colors[(x + y) % 2]
      ctx.fillRect(-size / 2, -size / 2, size, size)
      polygon(ctx, colors[2 + ((x + y) % 2)], [[-size/2,-size/2],[size/2,-size/2],[-size/2,size/2]])
      ctx.strokeStyle = '#0c112749'
      ctx.lineWidth = 1
      ctx.strokeRect(-size/2,-size/2,size,size)
      ctx.restore()
    })
    context.fillStyle = '#191828'
    context.fillRect(0,0,1000,640)
    context.drawImage(quilt,200,20)
    detail(`${count} × ${count} blocks · 600 px square`)
  }
  choice('Fabric palette', Object.keys(palettes), palette, value => { palette = value; draw() })
  range('Blocks per side', 4, 10, count, value => { count = value; reset() })
  button('Reset layout', reset)
  pointer((x,y) => {
    if (x < 200 || x >= 800 || y < 20 || y >= 620) return
    const index = Math.floor((y - 20) * count / 600) * count + Math.floor((x - 200) * count / 600)
    cells[index] = (cells[index] + 1) % 4
    draw()
  })
  exportAs(() => quilt)
  reset()
  return ({ clickCanvas, assert }) => {
    const before = cells[0]
    clickCanvas(235,55)
    assert(cells[0] === (before + 1) % 4, 'Quilt block did not rotate')
  }
}
