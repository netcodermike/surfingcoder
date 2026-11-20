import { landscape, fit } from './art.js'

const ratios = { 'Square · 1:1': 1, 'Landscape · 16:9': 16 / 9, 'Portrait · 4:5': 4 / 5, 'Classic · 3:2': 3 / 2 }

export function mount({ context, surface, choice, color, range, photo, pointer, detail, status, clamp, exportAs }) {
  let source = landscape(surface), ratio = 1, zoom = 1.18, border = 12, borderColor = '#f5dfc0'
  let center = [.55, .5], layout

  function crop() {
    const w = Math.min(source.width, source.height * ratio) / zoom
    const h = w / ratio
    return [clamp(center[0] * source.width - w / 2, 0, source.width - w),
      clamp(center[1] * source.height - h / 2, 0, source.height - h), w, h]
  }
  function draw() {
    context.fillStyle = '#151523'
    context.fillRect(0, 0, 1000, 640)
    layout = fit(context, source, 1000, 640)
    const [x, y, w, h] = crop()
    const scale = layout.w / source.width
    const box = [layout.x + x * scale, layout.y + y * scale, w * scale, h * scale]
    context.fillStyle = '#110c1bb5'
    context.beginPath()
    context.rect(0, 0, 1000, 640)
    context.rect(...box)
    context.fill('evenodd')
    context.lineWidth = Math.max(2, border * scale)
    context.strokeStyle = borderColor
    context.strokeRect(...box)
    context.strokeStyle = '#fff9'
    context.lineWidth = 1
    for (const t of [1 / 3, 2 / 3]) {
      context.beginPath()
      context.moveTo(box[0] + box[2] * t, box[1])
      context.lineTo(box[0] + box[2] * t, box[1] + box[3])
      context.moveTo(box[0], box[1] + box[3] * t)
      context.lineTo(box[0] + box[2], box[1] + box[3] * t)
      context.stroke()
    }
    detail(`${Math.round(w) + border * 2} × ${Math.round(h) + border * 2} export`)
  }
  const aspect = choice('Crop ratio', Object.keys(ratios), 'Square · 1:1', value => { ratio = ratios[value]; draw() })
  range('Zoom (%)', 100, 300, 118, value => { zoom = value / 100; draw() })
  range('Frame (px)', 0, 55, border, value => { border = value; draw() })
  color('Frame color', borderColor, value => { borderColor = value; draw() })
  const aim = (x, y) => {
    center = [(x - layout.x) / layout.w, (y - layout.y) / layout.h]
    draw()
  }
  pointer(aim, aim)
  photo((image, filename) => { source = image; center = [.5, .5]; status(filename); draw() })
  exportAs(() => {
    const [x,y,w,h] = crop()
    const innerW = Math.max(1, Math.round(w)), innerH = Math.max(1, Math.round(h))
    const output = surface(innerW + 2 * border, innerH + 2 * border)
    const ctx = output.getContext('2d')
    if (border) {
      ctx.fillStyle = borderColor
      ctx.fillRect(0, 0, output.width, output.height)
    }
    ctx.drawImage(source, x, y, w, h, border, border, innerW, innerH)
    return output
  })
  status('Sample landscape')
  draw()
  return ({ update, clickCanvas, assert }) => {
    update(aspect, 'Landscape · 16:9')
    clickCanvas(630, 310)
    const [, , w, h] = crop()
    assert(Math.abs(w / h - 16 / 9) < 1e-9, 'Incorrect crop ratio')
  }
}
