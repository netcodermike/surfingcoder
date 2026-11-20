import { browser } from '../../assets/browser-studio-export.js'
import { mount } from './tool.js'
import { project } from './project.js'

const select = id => document.getElementById(id)
const canvas = document.querySelector('canvas')
const context = canvas.getContext('2d', { willReadFrequently: true })
const controls = select('controls')
const status = message => { select('status').textContent = message }
const detail = message => { select('detail').textContent = message }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
let activeExport = () => canvas
let format = 'png'

document.title = project.title
document.querySelector('h1').textContent = project.title
select('subtitle').textContent = project.subtitle
select('hint').textContent = project.hint
select('view-label').textContent = project.view
select('tool-label').textContent = project.tools
document.documentElement.style.setProperty('--accent', project.accent)

function button(label, callback, parent = controls, primary = false) {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  if (primary) element.className = 'primary'
  element.addEventListener('click', async () => {
    try { await callback() } catch (error) { status(error.message || 'Action failed') }
  })
  parent.append(element)
  return element
}

function group(parent = controls) {
  const row = document.createElement('div')
  row.className = 'button-row'
  parent.append(row)
  return row
}

function field(label, element) {
  const wrapper = document.createElement('label')
  wrapper.className = 'field'
  const name = document.createElement('span')
  name.textContent = label
  wrapper.append(name, element)
  controls.append(wrapper)
  return wrapper
}

function range(label, min, max, initial, callback, step = 1) {
  const input = document.createElement('input')
  Object.assign(input, { type: 'range', min, max, value: initial, step })
  const output = document.createElement('output')
  output.textContent = initial
  const wrapper = field(label, input)
  wrapper.insertBefore(output, input)
  input.addEventListener('input', () => {
    output.textContent = input.value
    callback(Number(input.value))
  })
  return input
}

function choice(label, options, initial, callback) {
  const input = document.createElement('select')
  for (const option of options) input.add(new Option(option, option))
  input.value = initial
  field(label, input)
  input.addEventListener('change', () => callback(input.value))
  return input
}

function color(label, value, callback) {
  const input = document.createElement('input')
  Object.assign(input, { type: 'color', value })
  field(label, input)
  input.addEventListener('input', () => callback(input.value))
  return input
}

function photo(callback) {
  const input = document.createElement('input')
  Object.assign(input, { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif' })
  input.hidden = true
  document.body.append(input)
  button('Open image', () => input.click(), select('actions'))
  input.addEventListener('change', async () => {
    const file = input.files[0]
    input.value = ''
    if (!file) return
    if (file.size > 25 * 1024 * 1024) return status('Choose an image smaller than 25 MB.')
    try {
      const bitmap = await createImageBitmap(file)
      try {
        const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
        const image = surface(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
        image.getContext('2d').drawImage(bitmap, 0, 0, image.width, image.height)
        callback(image, file.name)
      } finally {
        bitmap.close()
      }
    } catch {
      status('Could not open that image.')
    }
  })
}

function surface(width = 1000, height = 640) {
  const result = document.createElement('canvas')
  Object.assign(result, { width, height })
  return result
}

function point(event) {
  const bounds = canvas.getBoundingClientRect()
  const scale = Math.min(bounds.width / canvas.width, bounds.height / canvas.height)
  return [
    clamp((event.clientX - bounds.left - (bounds.width - canvas.width * scale) / 2) / scale, 0, canvas.width - 1),
    clamp((event.clientY - bounds.top - (bounds.height - canvas.height * scale) / 2) / scale, 0, canvas.height - 1),
  ]
}

function pointer(onDown, onMove = () => {}, onUp = () => {}) {
  let active
  canvas.classList.add('editable')
  canvas.addEventListener('pointerdown', event => {
    if (active !== undefined || event.button !== 0) return
    active = event.pointerId
    if (event.isTrusted) canvas.setPointerCapture(active)
    onDown(...point(event))
  })
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId === active) onMove(...point(event))
  })
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, event => {
      if (event.pointerId !== active) return
      active = undefined
      onUp(...point(event))
    })
  }
}

function exportAs(callback, extension = 'png') {
  activeExport = callback
  format = extension
  select('format').textContent = `${extension.toUpperCase()} export`
}

function readExport() {
  const value = activeExport()
  if (typeof value === 'string') return Promise.resolve(new TextEncoder().encode(value))
  return new Promise((resolve, reject) => {
    value.toBlob(async blob => {
      if (!blob) return reject(new Error('Could not encode artwork'))
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}

const save = button('Export PNG', async () => {
  const exported = await readExport()
  if (await browser.save(`${project.slug}.${format}`, exported)) status('Export saved.')
}, select('actions'), true)
exportAs(() => canvas)
const test = mount({ canvas, context, controls, button, group, range, choice, color, photo, pointer, status, detail,
  surface, clamp, exportAs })
save.textContent = `Export ${format.toUpperCase()}`

function checksum() {
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let hash = 2166136261
  for (let index = 0; index < pixels.length; index += 17) hash = Math.imul(hash ^ pixels[index], 16777619)
  return hash
}

function update(input, value) {
  input.value = value
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
}

function clickCanvas(x, y) {
  const bounds = canvas.getBoundingClientRect()
  const scale = Math.min(bounds.width / canvas.width, bounds.height / canvas.height)
  const settings = { bubbles: true, pointerId: 1, button: 0,
    clientX: bounds.left + (bounds.width - canvas.width * scale) / 2 + x * scale,
    clientY: bounds.top + (bounds.height - canvas.height * scale) / 2 + y * scale }
  for (const name of ['pointerdown', 'pointerup']) canvas.dispatchEvent(new PointerEvent(name, settings))
}

window.desktopReady = new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))
window.verifyDesktop = async () => {
  const assert = (value, message) => { if (!value) throw new Error(message) }
  assert(document.querySelector('h1').textContent === project.title, 'Incorrect desktop title')
  const before = checksum()
  await test({ update, clickCanvas, assert })
  assert(checksum() !== before, 'Artwork did not change')
  const bytes = await readExport()
  assert(bytes.length > 15 && (format !== 'png' || bytes[0] === 137 && bytes[1] === 80), 'Invalid export data')
  assert(await browser.save(`${project.slug}.${format}`, bytes), 'Native export bridge failed')
  return 'editing interaction and export verified'
}
