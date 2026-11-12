import { BUMPERS, LANES, WALLS, WIDTH, HEIGHT, flipperTip } from './physics.js'

function stroke(ctx, points, color, width) {
  ctx.beginPath()
  ctx.moveTo(...points[0])
  for (const point of points.slice(1)) ctx.lineTo(...point)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

function disc(ctx, x, y, radius, fill, border, width = 1) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (border) {
    ctx.strokeStyle = border
    ctx.lineWidth = width
    ctx.stroke()
  }
}

export function makeTable() {
  const surface = document.createElement('canvas')
  Object.assign(surface, { width: WIDTH, height: HEIGHT })
  const ctx = surface.getContext('2d')
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  background.addColorStop(0, '#241c43')
  background.addColorStop(.52, '#33204a')
  background.addColorStop(1, '#111d37')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.lineCap = ctx.lineJoin = 'round'
  const sun = ctx.createLinearGradient(0, 275, 0, 472)
  sun.addColorStop(0, '#ffb389')
  sun.addColorStop(1, '#ba578f')
  ctx.save()
  ctx.beginPath()
  ctx.arc(230, 372, 105, 0, Math.PI * 2)
  ctx.clip()
  for (let y = 260; y < 480; y += 13) {
    ctx.fillStyle = sun
    ctx.fillRect(118, y, 225, Math.max(4, 12 - (y - 260) / 27))
  }
  ctx.restore()
  const water = ctx.createLinearGradient(0, 360, 0, 690)
  water.addColorStop(0, '#65d8c4')
  water.addColorStop(.38, '#236a8e')
  water.addColorStop(1, '#1a2349')
  ctx.beginPath()
  ctx.moveTo(21, 513)
  ctx.bezierCurveTo(137, 532, 139, 386, 275, 377)
  ctx.bezierCurveTo(341, 373, 385, 397, 402, 444)
  ctx.bezierCurveTo(363, 419, 326, 429, 311, 453)
  ctx.bezierCurveTo(282, 514, 382, 531, 445, 532)
  ctx.lineTo(445, 716)
  ctx.lineTo(21, 716)
  ctx.closePath()
  ctx.fillStyle = water
  ctx.fill()
  ctx.strokeStyle = '#a8eae37e'
  ctx.lineWidth = 3
  ctx.stroke()
  for (let ribbon = 0; ribbon < 9; ribbon++) {
    const y = ribbon * 11
    ctx.beginPath()
    ctx.moveTo(27, 545 + y)
    ctx.bezierCurveTo(149, 549 + y, 170, 420 + y, 279, 408 + y)
    ctx.bezierCurveTo(322, 402 + y, 353, 410 + y, 377, 422 + y)
    ctx.strokeStyle = ribbon % 3 === 0 ? '#96f4d749' : '#7ed9f22b'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  for (let dot = 0; dot < 44; dot++) {
    const x = 47 + (dot * 83) % 376, y = 103 + (dot * 37) % 255
    disc(ctx, x, y, dot % 5 === 0 ? 1.5 : .8, '#fff0db62')
  }
  ctx.fillStyle = '#181529'
  ctx.fillRect(452, 154, 39, 548)
  ctx.fillStyle = '#bb94d7'
  ctx.font = 'bold 11px Consolas, monospace'
  ctx.save()
  ctx.translate(477, 498)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('LAUNCH LANE', 0, 0)
  ctx.restore()
  for (const [x, y, ex, ey, material] of WALLS) {
    const sling = material === 'sling'
    stroke(ctx, [[x, y], [ex, ey]], sling ? '#6d4979' : '#0c0a1c', sling ? 10 : 9)
    stroke(ctx, [[x, y], [ex, ey]], sling ? '#f7a2c0' : '#9273ab', sling ? 2.5 : 2)
  }
  ctx.fillStyle = '#e9d4fa'
  ctx.font = 'bold 11px Consolas, monospace'
  ctx.textAlign = 'center'
  ctx.fillText('TOP LANES  •  150', 243, 118)
  ctx.fillStyle = '#d9f4f1'
  ctx.font = 'italic 700 30px Georgia, serif'
  ctx.fillText('Ride the Set', 226, 508)
  return surface
}

export function render(ctx, table, game, paused) {
  ctx.drawImage(table, 0, 0)
  LANES.forEach((x, index) => {
    const active = game.laneFlash[index] > 0 || game.multiplier > 0
    stroke(ctx, [[x - 8, 77], [x, 69], [x + 8, 77]], active ? '#f3efb3' : '#b98dde', 3)
  })
  for (const [index, { x, y, r, color, label }] of BUMPERS.entries()) {
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = game.flash[index] ? 30 : game.lit[index] ? 17 : 8
    disc(ctx, x, y, r, '#241b3e', color, 3)
    ctx.restore()
    disc(ctx, x, y, r - 9, game.flash[index] ? color : '#443454', color + '80')
    ctx.fillStyle = game.flash[index] ? '#20182f' : color
    ctx.font = 'bold 18px Consolas, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, x, y + 6)
  }
  for (const flipper of game.flippers) {
    const tip = flipperTip(flipper)
    stroke(ctx, [[flipper.x, flipper.y], tip], '#412b57', 24)
    stroke(ctx, [[flipper.x, flipper.y], tip], '#dca9f2', 17)
    disc(ctx, flipper.x, flipper.y, 6, '#6a447c')
  }
  if (game.mode !== 'over') {
    const { x, y } = game.ball
    const shine = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, 9)
    shine.addColorStop(0, '#ffffff')
    shine.addColorStop(.45, '#d5f0fd')
    shine.addColorStop(1, '#615e96')
    disc(ctx, x, y, 8, shine, '#f7eaff')
  }
  if (game.mode === 'ready') {
    const y = 679 + game.charge * 14
    stroke(ctx, [[458, y], [485, y]], '#efc3ff', 5)
  }
  if (game.multiplier > 0) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#eaf3b2'
    ctx.font = 'bold 18px Consolas, monospace'
    ctx.fillText(`2× SET  ${Math.ceil(game.multiplier)}s`, 240, 552)
  }
  if (paused || game.mode === 'over') {
    ctx.fillStyle = '#171021d9'
    ctx.fillRect(48, 295, 390, 100)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f4e9fa'
    ctx.font = 'bold 29px Segoe UI, sans-serif'
    ctx.fillText(paused ? 'Paused' : 'Game over', 243, 353)
  }
}
