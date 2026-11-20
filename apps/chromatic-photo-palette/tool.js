import { browser } from '../../assets/browser-studio-export.js'
import { landscape, fit } from './art.js'

const toHex = rgb => '#' + rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')
const distance = (left, right) => left.reduce((total, channel, index) => total + (channel - right[index]) ** 2, 0)

export function mount({ context, surface, range, photo, button, controls, detail, status, exportAs }) {
  let source = landscape(surface), count = 6, palette = []
  const list = document.createElement('div')
  list.className = 'swatch-list'
  const colors = range('Palette size', 3, 9, count, value => { count = value; draw() })
  controls.append(list)

  function draw() {
    const sample = surface(160, 106)
    const ctx = sample.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(source, 0, 0, 160, 106)
    const bytes = ctx.getImageData(0, 0, 160, 106).data
    const bins = new Map()
    for (let i = 0; i < bytes.length; i += 4) {
      if (bytes[i + 3] < 128) continue
      const rgb = [bytes[i], bytes[i + 1], bytes[i + 2]]
      const key = rgb.map(channel => channel >> 4).join('/')
      const entry = bins.get(key) ?? { count: 0, sum: [0,0,0] }
      entry.count++
      rgb.forEach((channel, index) => { entry.sum[index] += channel })
      bins.set(key, entry)
    }
    const ranked = [...bins.values()].sort((a, b) => b.count - a.count)
      .map(item => item.sum.map(channel => Math.round(channel / item.count)))
    palette = []
    for (const candidate of ranked) {
      if (palette.every(other => distance(other, candidate) >= 38 ** 2)) palette.push(candidate)
      if (palette.length === count) break
    }
    for (const candidate of ranked) {
      if (palette.length === count) break
      if (palette.every(other => distance(other, candidate) > 0)) palette.push(candidate)
    }
    context.fillStyle = '#161623'
    context.fillRect(0,0,1000,640)
    fit(context, source, 1000, 485)
    list.replaceChildren()
    palette.forEach((rgb, index) => {
      const hex = toHex(rgb), width = 1000 / palette.length
      context.fillStyle = hex
      context.fillRect(width * index, 499, width + 1, 141)
      const item = button(hex.toUpperCase(), async () => {
        await browser.copyColor(hex)
        status(`Copied ${hex.toUpperCase()}`)
      }, list)
      const marker = document.createElement('i')
      marker.style.background = hex
      item.prepend(marker)
    })
    detail(`${palette.length} distinct swatches`)
  }
  photo((image, filename) => { source = image; status(filename); draw() })
  exportAs(() => [':root {', ...palette.map((rgb, i) => `  --photo-color-${i + 1}: ${toHex(rgb)};`), '}', ''].join('\n'), 'css')
  status('Sample landscape')
  draw()
  return ({ update, assert }) => {
    update(colors, 4)
    assert(list.childElementCount === 4 && palette.length === 4, 'Wrong palette size')
  }
}
