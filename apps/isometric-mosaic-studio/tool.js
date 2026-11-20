import { polygon } from './art.js'

const colors = {
  'Lagoon': ['#162943','#21b1a9','#f9a36c','#9e85ed','#ebdfb6'],
  'Marigold': ['#302444','#fe8f6c','#ffc85b','#f875a5','#fff0c1'],
  'Glacier': ['#1e2a44','#81a3ff','#59ceea','#b289de','#dce5f8'],
}

export function mount({ context, choice, button, pointer, detail, group }) {
  let theme = 'Lagoon', paint = 2
  const tiles = []
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 12; col++) {
      const x = 62 + col * 80 + (row % 2) * 40, y = 51 + row * 60
      const distance = Math.hypot((x - 500) / 1.6, y - 312)
      tiles.push({ x, y, index: distance < 75 ? 3 : distance < 150 ? 2 : distance < 215 ? 1 : 0 })
    }
  }
  function draw() {
    context.fillStyle = '#171724'
    context.fillRect(0,0,1000,640)
    for (const {x,y,index} of tiles) {
      const palette = colors[theme]
      polygon(context,palette[index],[[x,y-39],[x+37,y],[x,y+39],[x-37,y]])
      polygon(context,'#0c0d2536',[[x,y-39],[x,y+39],[x-37,y]])
      polygon(context,'#f7f1ff27',[[x,y-39],[x+37,y],[x,y-8]])
    }
    detail(`${tiles.length} facets · ${theme}`)
  }
  const palette = choice('Palette', Object.keys(colors), theme, value => { theme = value; draw() })
  choice('Paint color', ['01','02','03','04','05'], '03', value => { paint = Number(value) - 1 })
  const actions = group()
  button('Invert colors', () => { for (const tile of tiles) tile.index = 4 - tile.index; draw() }, actions)
  button('Clear', () => { for (const tile of tiles) tile.index = 0; draw() }, actions)
  const stamp = (x,y) => {
    const tile = tiles.find(item => Math.abs(x - item.x) / 37 + Math.abs(y - item.y) / 39 <= 1)
    if (tile && tile.index !== paint) { tile.index = paint; draw() }
  }
  pointer(stamp, stamp)
  draw()
  return ({ update, clickCanvas, assert }) => {
    update(palette, 'Glacier')
    clickCanvas(62,51)
    assert(theme === 'Glacier' && tiles[0].index === 2, 'Mosaic paint failed')
  }
}
