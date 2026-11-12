// The long-haired surfer is drawn as original card artwork.
export function drawJoker() {
  const canvas = document.createElement('canvas')
  canvas.width = 100
  canvas.height = 116
  canvas.className = 'joker-art'
  canvas.setAttribute('aria-hidden', 'true')
  const ctx = canvas.getContext('2d')
  const fill = (path, color) => {
    ctx.fillStyle = color
    ctx.fill(new Path2D(path))
  }
  ctx.fillStyle = '#ffd28e'
  ctx.beginPath()
  ctx.arc(56,50,34,0,Math.PI*2)
  ctx.fill()
  fill('M8 85 Q44 63 66 84 T100 80 V116 H8 Z','#3e9e9a')
  fill('M5 102 Q49 91 95 99 Q63 110 29 112 Z','#faf0cb')
  fill('M42 31 Q49 17 62 23 Q72 29 67 42 Q68 48 77 55 Q59 56 53 45 Q48 56 35 55 Q44 49 42 31 Z','#4c2d49')
  fill('M51 30 Q62 27 64 35 Q65 42 57 46 L53 52 L46 46 L51 39 Z','#d98e69')
  fill('M47 45 Q52 43 57 50 L64 64 L53 75 L37 63 Z','#db795f')
  fill('M44 48 L31 61 L20 58 L18 62 L32 69 L49 57 Z','#e5a478')
  fill('M57 50 L70 59 L82 54 L85 57 L71 66 L56 61 Z','#e5a478')
  fill('M38 62 L55 70 L52 82 L36 83 L31 74 Z','#443b66')
  fill('M35 80 L43 83 L38 91 L26 101 L19 101 L32 88 Z','#e5a478')
  fill('M47 79 L53 78 L63 89 L75 97 L69 100 L55 93 L43 86 Z','#e5a478')
  fill('M41 32 Q49 16 61 24 L66 28 Q56 28 51 35 Q48 46 36 52 Q42 44 41 32 Z','#4c2d49')
  return canvas
}
