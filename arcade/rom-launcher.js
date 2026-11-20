const dialog = document.getElementById('rom-dialog')
const open = document.getElementById('rom-open')
const input = document.getElementById('rom-file')
const screen = document.getElementById('rom-screen')
const error = document.getElementById('rom-error')
const title = document.getElementById('rom-filename')
const playerStyles = new URL('./rom-player.css', import.meta.url).href
const playerScript = new URL('./rom-player.js', import.meta.url).href
let frame
let requested = 0

open.addEventListener('click', () => input.click())
input.addEventListener('change', async () => {
  const file = input.files[0]
  const selection = ++requested
  input.value = ''
  if (!file) return
  error.textContent = ''
  try {
    if (!/^[^/\\]+\.zip$/i.test(file.name) || file.size < 22 || file.size > 64 * 1024 * 1024) {
      throw new Error('Choose an arcade ROM ZIP up to 64 MB.')
    }
    const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    if (selection !== requested) return
    if (signature.join(',') !== '80,75,3,4') throw new Error('This file does not contain a ZIP archive.')
    document.dispatchEvent(new Event('arcade:open-rom'))
    title.textContent = file.name
    const player = document.createElement('iframe')
    player.title = 'MAME browser player'
    player.allow = 'autoplay; fullscreen'
    player.srcdoc = `<!doctype html><html lang="en"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>MAME Browser Player</title><link rel="stylesheet" href="${playerStyles}">
      <script src="${playerScript}" defer></script></head><body>
      <main id="game" aria-label="Arcade emulator"></main>
      <p id="notice" role="status">Opening the emulator…</p></body></html>`
    player.addEventListener('load', () => {
      if (frame === player) player.contentWindow.postMessage({type: 'play-local-rom', file}, location.origin)
    }, {once: true})
    frame = player
    screen.replaceChildren(player)
    dialog.showModal()
  } catch (problem) {
    if (selection === requested) error.textContent = problem.message
  }
})
document.getElementById('close-rom').addEventListener('click', () => dialog.close())
dialog.addEventListener('close', () => {
  frame?.remove()
  frame = null
  open.focus()
})
