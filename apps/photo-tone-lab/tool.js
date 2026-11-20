import { landscape, fit } from './art.js'

export function mount({ context, surface, range, photo, button, group, detail, status, exportAs }) {
  let source = landscape(surface), name = 'Sample landscape'
  const initial = { brightness: 104, contrast: 109, saturation: 119, warmth: 0 }
  const values = { ...initial }
  let compare = true
  const edited = surface()

  function draw() {
    edited.width = source.width
    edited.height = source.height
    const output = edited.getContext('2d', { willReadFrequently: true })
    output.filter = `brightness(${values.brightness}%) contrast(${values.contrast}%) saturate(${values.saturation}%) sepia(${values.warmth}%)`
    output.drawImage(source, 0, 0)
    context.fillStyle = '#151523'
    context.fillRect(0, 0, 1000, 640)
    const box = fit(context, edited, 1000, 520)
    if (compare) {
      context.save()
      context.beginPath()
      context.rect(box.x, box.y, box.w / 2, box.h)
      context.clip()
      context.drawImage(source, box.x, box.y, box.w, box.h)
      context.restore()
      context.fillStyle = '#f8e8ff'
      context.fillRect(499, box.y, 2, box.h)
    }
    const data = output.getImageData(0, 0, edited.width, edited.height).data
    const bins = Array.from({ length: 3 }, () => Array(64).fill(0))
    for (let i = 0; i < data.length; i += 32) {
      if (data[i + 3] === 0) continue
      for (let channel = 0; channel < 3; channel++) bins[channel][data[i + channel] >> 2]++
    }
    const peak = Math.max(1, ...bins.flat())
    for (let channel = 0; channel < 3; channel++) {
      context.beginPath()
      bins[channel].forEach((count, i) => context.lineTo(32 + i * 14.8, 612 - count / peak * 68))
      context.lineWidth = 2.6
      context.strokeStyle = ['#ff859a','#8ce8ba','#89b7ff'][channel]
      context.stroke()
    }
    detail(`${source.width} × ${source.height} · ${compare ? 'Before / after' : 'Edited'}`)
  }

  const inputs = Object.fromEntries(Object.keys(values).map(key => [
    key, range(key[0].toUpperCase() + key.slice(1), key === 'warmth' ? 0 : 30, key === 'warmth' ? 100 : 200,
      values[key], value => { values[key] = value; draw() }),
  ]))
  const actions = group()
  const toggle = button('Hide comparison', () => {
    compare = !compare
    toggle.textContent = compare ? 'Hide comparison' : 'Show comparison'
    draw()
  }, actions)
  button('Reset', () => {
    for (const [key, input] of Object.entries(inputs)) {
      input.value = initial[key]
      input.previousElementSibling.textContent = initial[key]
    }
    Object.assign(values, initial)
    draw()
  }, actions)
  photo((image, filename) => { source = image; name = filename; status(name); draw() })
  exportAs(() => edited)
  status(name)
  draw()
  return ({ update, assert }) => {
    update(inputs.saturation, 42)
    assert(values.saturation === 42 && edited.width === source.width, 'Tone update failed')
  }
}
