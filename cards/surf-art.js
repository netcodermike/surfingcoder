const theme = {
  spades:['#d7ecea','#176869','#0f4355'],
  hearts:['#f8dfd4','#b75670','#753c60'],
  clubs:['#eee1f5','#745398','#512b75'],
  diamonds:['#fae7c9','#e58e57','#94486c'],
}

function shape(ctx,ink,path) {
  ctx.fillStyle = ink
  ctx.fill(new Path2D(path))
}

export function drawSurfSuit(suit) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 112
  canvas.className = 'surf-art'
  canvas.setAttribute('aria-hidden','true')
  const ctx = canvas.getContext('2d')
  const [paper,accent,deep] = theme[suit]
  const glow = ctx.createLinearGradient(0,5,0,108)
  glow.addColorStop(0,'#fff3d8')
  glow.addColorStop(1,paper)
  ctx.fillStyle = glow
  ctx.beginPath();ctx.arc(56,56,49,0,Math.PI*2);ctx.fill()
  ctx.save();ctx.clip()
  shape(ctx,accent,'M0 82 Q24 74 45 82 T90 82 Q103 76 112 77 V112 H0 Z')
  shape(ctx,deep,'M0 95 Q24 87 45 95 T90 95 Q102 88 112 89 V112 H0 Z')
  if (suit === 'spades') {
    shape(ctx,deep,'M10 81 C21 45 37 20 65 26 C84 30 89 40 88 52 C79 42 64 44 60 57 C55 75 73 83 103 80 L103 95 L10 95 Z')
    shape(ctx,accent,'M15 82 C27 43 46 23 65 26 C78 28 86 36 89 45 C67 33 47 41 43 63 C40 75 48 81 61 85 L28 87 Z')
    shape(ctx,'#fff3dc','M50 30 C67 21 86 30 91 44 C93 50 87 56 83 50 C78 44 78 42 73 44 C69 47 66 42 62 42 C57 49 53 45 54 40 C47 42 43 42 42 40 Z')
  } else if (suit === 'hearts') {
    shape(ctx,deep,'M20 77 C56 70 52 29 83 26 C71 41 75 58 94 77 Z')
    shape(ctx,accent,'M30 76 C57 62 56 34 79 28 C66 45 67 63 84 76 Z')
    shape(ctx,'#fff1d1','M33 73 C55 61 60 42 70 36 C62 48 59 65 46 73 Z')
  } else if (suit === 'clubs') {
    shape(ctx,deep,'M33 88 C19 92 25 67 41 49 C58 29 79 20 87 23 C92 34 81 57 65 72 C55 82 42 89 33 88 Z')
    shape(ctx,accent,'M33 84 C26 86 31 68 44 51 C60 34 76 24 84 25 C84 37 74 55 62 67 C53 77 42 82 33 84 Z')
    shape(ctx,'#fff1d1','M35 81 Q59 63 81 28 Q65 61 38 83 Z')
  } else {
    ctx.fillStyle = accent
    ctx.beginPath();ctx.arc(56,54,25,0,Math.PI*2);ctx.fill()
    shape(ctx,'#fff2d5','M0 56 H112 V60 H0 Z M0 66 H112 V70 H0 Z')
  }
  ctx.restore()
  return canvas
}
