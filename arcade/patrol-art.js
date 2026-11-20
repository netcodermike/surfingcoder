import {HEIGHT, SURF_Y, WIDTH, waterline} from './patrol.js?v=20261120-surf'

const jerseys = ['#59eadc', '#ff9e80']
const boardEdges = ['#115964', '#96384d']
const foam = '#d0fff2'
const sand = '#ffcb9e'
const outline = '#17152f'

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function stroke(ctx, points, color, width) {
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(...points[0])
  for (const point of points.slice(1)) ctx.lineTo(...point)
  ctx.stroke()
}

function board(ctx, color, scale = 1) {
  ctx.save()
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.moveTo(-27, 1)
  ctx.bezierCurveTo(-20, -5, 14, -7, 27, -2)
  ctx.bezierCurveTo(22, 4, -11, 9, -26, 5)
  ctx.closePath()
  ctx.lineWidth = 2.6
  ctx.strokeStyle = outline
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fill()
  ctx.save()
  ctx.clip()
  stroke(ctx, [[-16, 12], [0, -11]], '#fff1bd', 7)
  stroke(ctx, [[-7, 11], [9, -10]], '#2d2647', 2.4)
  stroke(ctx, [[-24, 1], [25, -3]], '#fff6dd', 1)
  ctx.restore()
  ctx.restore()
}

function ride(ctx, surfer, time, shield, reduced) {
  const {x, y, lane, id, facing, lean} = surfer
  const slope = Math.atan2(waterline(x + 7, time, lane) - waterline(x - 7, time, lane), 14)
  const speed = Math.abs(lean), crouch = speed * 4
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(slope * .85)
  ctx.scale(facing, 1)
  const wake = 18 + speed * 20
  for (let i = 0; i < 6; i++) {
    const flight = (time * 42 + i * 7) % wake
    const offset = -12 - flight
    ellipse(ctx, offset, 8 + (i % 3) * 3 - flight * .09, 2.5 - flight / wake, 1.1, i % 2 ? '#62dce0' : foam)
  }
  if (shield && (reduced || Math.floor(shield * 8) % 2 === 0)) {
    ctx.strokeStyle = jerseys[id]
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(0, -10, 34, 32, 0, 0, 2 * Math.PI)
    ctx.stroke()
  }
  board(ctx, jerseys[id])
  const hip = [2 + speed * 3, -16 + crouch]
  const shoulder = [6 + speed * 6, -27 + crouch]
  const head = [shoulder[0] + 3, shoulder[1] - 7]
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  stroke(ctx, [[-10, 1], [-11, -11], hip, [13, -9], [9, -1]], outline, 7)
  stroke(ctx, [[-10, 1], [-11, -11], hip, [13, -9], [9, -1]], boardEdges[id], 4)
  stroke(ctx, [hip, shoulder], outline, 13)
  stroke(ctx, [hip, shoulder], jerseys[id], 9)
  const throwing = surfer.cooldown > .16
  const hand = throwing ? [shoulder[0] + 3, shoulder[1] - 15] : [23, shoulder[1] + 4]
  stroke(ctx, [[-14, shoulder[1] + 5], [-3, shoulder[1] - 2], shoulder, [15, shoulder[1] + 2], hand], outline, 6)
  stroke(ctx, [[-14, shoulder[1] + 5], [-3, shoulder[1] - 2], shoulder, [15, shoulder[1] + 2], hand], sand, 3.3)
  const hair = 10 + 16 * speed
  const flick = reduced ? 0 : Math.sin(time * 14 + id) * (1.2 + speed * 2.8)
  ctx.fillStyle = id ? '#60314f' : '#3a223b'
  ctx.beginPath()
  ctx.moveTo(head[0] + 3, head[1] - 5)
  ctx.bezierCurveTo(head[0] - 6, head[1] - 10, head[0] - hair + 5, head[1] - 5, head[0] - hair, head[1] - 7 + flick)
  ctx.bezierCurveTo(head[0] - hair + 1, head[1] + 2 + flick, head[0] - 8, head[1] + 4, head[0] + 2, head[1] + 5)
  ctx.closePath()
  ctx.strokeStyle = outline
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.fill()
  stroke(ctx, [[head[0] - hair + 4, head[1] - 5 + flick], [head[0] - 8, head[1] - 6], [head[0] - 2, head[1] - 3]], '#b7716e', 1)
  ellipse(ctx, head[0] + 1.5, head[1] + 1, 4.4, 5, sand)
  ellipse(ctx, head[0] + 4.3, head[1], 1, .9, outline)
  ctx.restore()
}

function paintCreaturePart(ctx, color, edge = outline) {
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.65
  ctx.stroke()
}

function glare(ctx, x, y, side, color) {
  ctx.beginPath()
  ctx.moveTo(x - side * 2.6, y - 1.9)
  ctx.lineTo(x + side * 2.4, y + .2)
  ctx.lineTo(x - side * 1.6, y + 1.4)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function manta(ctx, flap) {
  ctx.beginPath()
  ctx.moveTo(-22, -6 - flap * .8)
  ctx.lineTo(-8, -9)
  ctx.quadraticCurveTo(-5, -7, -3, -11)
  ctx.lineTo(0, -8)
  ctx.lineTo(3, -11)
  ctx.quadraticCurveTo(5, -7, 8, -9)
  ctx.lineTo(22, -6 + flap * .8)
  ctx.quadraticCurveTo(15, 2, 7, 5)
  ctx.quadraticCurveTo(3, 8, 2, 9)
  ctx.quadraticCurveTo(4, 14, -7, 16)
  ctx.quadraticCurveTo(-2, 12, -3, 8)
  ctx.quadraticCurveTo(-9, 6, -22, -6 - flap * .8)
  paintCreaturePart(ctx, '#65528a', '#191531')
  stroke(ctx, [[-20, -6 - flap * .8], [-9, -7], [-5, -3]], '#ae8acf', 1.2)
  stroke(ctx, [[20, -6 + flap * .8], [9, -7], [5, -3]], '#ae8acf', 1.2)
  stroke(ctx, [[0, -2], [0, 4], [-4, 7]], '#3f315f', 1.4)
  glare(ctx, -4.2, -.5, 1, '#ffd8a0')
  glare(ctx, 4.2, -.5, -1, '#ffd8a0')
}

function squid(ctx, ripple) {
  ctx.lineCap = 'round'
  for (const x of [-10, -5, 0, 5, 10]) {
    ctx.beginPath()
    ctx.moveTo(x * .76, 3)
    ctx.bezierCurveTo(x * 1.5 + ripple * .38, 10, x * 1.35 - ripple * .55, 15, x * 1.65, 15 - Math.abs(x) * .4)
    ctx.strokeStyle = '#221630'
    ctx.lineWidth = 4.4
    ctx.stroke()
    ctx.strokeStyle = x % 2 ? '#944478' : '#b76088'
    ctx.lineWidth = 2.45
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(0, -16)
  ctx.quadraticCurveTo(8, -13, 12, -4)
  ctx.lineTo(17, 1)
  ctx.lineTo(12, 5)
  ctx.quadraticCurveTo(3, 11, -12, 5)
  ctx.lineTo(-17, 1)
  ctx.lineTo(-12, -4)
  ctx.quadraticCurveTo(-8, -13, 0, -16)
  paintCreaturePart(ctx, '#793c70', '#221630')
  stroke(ctx, [[-12, -4], [-8, -10], [0, -14]], '#c67b9e', 1.4)
  glare(ctx, -4.9, .6, 1, '#ffe9bf')
  glare(ctx, 4.9, .6, -1, '#ffe9bf')
}

function crab(ctx, snap) {
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)
    for (const [i, reach] of [19, 16, 12].entries()) {
      const leg = [[8, 3 + i * 1.3], [reach - 2, 6 + i], [reach, 10 + i + snap * .13]]
      stroke(ctx, leg, '#2d1b32', 4.4)
      stroke(ctx, leg, '#a64a51', 2.45)
    }
    const claw = -1 - snap * .38 * side
    stroke(ctx, [[8, 0], [14, claw + 4], [17, claw]], '#452838', 4.7)
    ctx.beginPath()
    ctx.moveTo(14, claw + 4)
    ctx.quadraticCurveTo(9, claw, 12, claw - 6)
    ctx.lineTo(16, claw - 10)
    ctx.lineTo(16, claw - 3.5)
    ctx.lineTo(22, claw - 8)
    ctx.quadraticCurveTo(24, claw, 20, claw + 3)
    ctx.quadraticCurveTo(17, claw + 5, 14, claw + 4)
    paintCreaturePart(ctx, '#bb5c5b', '#321b32')
    stroke(ctx, [[19, claw - 1], [21, claw - 3]], '#ee9a83', 1.3)
    ctx.restore()
  }
  ctx.beginPath()
  ctx.moveTo(-12, 1)
  ctx.lineTo(-9, -5)
  ctx.quadraticCurveTo(0, -10, 9, -5)
  ctx.lineTo(12, 1)
  ctx.quadraticCurveTo(10, 10, 0, 9)
  ctx.quadraticCurveTo(-10, 10, -12, 1)
  paintCreaturePart(ctx, '#963e50', '#321b32')
  stroke(ctx, [[-8, -3], [0, -5], [8, -3]], '#e48576', 1.15)
  glare(ctx, -4, .8, 1, '#ffe1aa')
  glare(ctx, 4, .8, -1, '#ffe1aa')
}

function shark(ctx, tail) {
  ctx.beginPath()
  ctx.moveTo(-24, 2)
  ctx.quadraticCurveTo(-19, -5, -9, -6)
  ctx.lineTo(-3, -16)
  ctx.lineTo(6, -6)
  ctx.quadraticCurveTo(12, -5.5, 17, -2)
  ctx.lineTo(23, -9 + tail * .58)
  ctx.lineTo(21, 1)
  ctx.lineTo(24, 9 + tail * .58)
  ctx.lineTo(15, 4)
  ctx.lineTo(8, 5)
  ctx.lineTo(7, 12)
  ctx.lineTo(0, 7)
  ctx.quadraticCurveTo(-14, 9, -23, 4)
  paintCreaturePart(ctx, '#4b7790', '#152032')
  stroke(ctx, [[-19, -1], [-9, -4.5], [-3, -14], [4, -6]], '#8cb4c3', 1.15)
  ctx.beginPath()
  ctx.moveTo(-22, 3)
  ctx.quadraticCurveTo(-15, 3, -9, 0)
  ctx.quadraticCurveTo(-9, 6, -20, 5.2)
  paintCreaturePart(ctx, '#432940', '#263349')
  ctx.fillStyle = '#f1e2c6'
  for (let i = 0; i < 3; i++) {
    const x = -19 + 2.65 * i, y = 3.35 - .42 * i
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 1.7, y - .3)
    ctx.lineTo(x + 1, y + 1.5)
    ctx.fill()
  }
  glare(ctx, -14.5, -1.9, -1, '#ffd5a0')
  stroke(ctx, [[-5, -1.4], [-4.3, 2.5]], '#263e56', 1.1)
  stroke(ctx, [[-2.5, -1.6], [-1.8, 2.1]], '#263e56', 1.1)
}

const creatures = [manta, squid, crab, shark]

function shell(ctx) {
  ctx.fillStyle = '#ffcc86'
  ctx.strokeStyle = '#412945'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-4, 8)
  ctx.bezierCurveTo(-23, -7, -10, -14, 0, -12)
  ctx.bezierCurveTo(10, -14, 23, -7, 4, 8)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  for (const x of [-9, -4, 4, 9]) stroke(ctx, [[0, 6], [x, -7]], '#aa655b', 1)
}

function horizon(ctx, time, bonus) {
  const sky = ctx.createLinearGradient(0, 0, 0, 95)
  sky.addColorStop(0, bonus ? '#312659' : '#39284d')
  sky.addColorStop(.7, bonus ? '#bb6386' : '#b45e78')
  sky.addColorStop(1, '#ffc08f')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, WIDTH, 96)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, WIDTH, 83)
  ctx.clip()
  ellipse(ctx, 360, 71, 31, 31, '#ffcd95')
  for (const y of [57, 65, 75, 82]) {
    ctx.fillStyle = '#a650685b'
    ctx.fillRect(330, y, 60, 2)
  }
  ctx.restore()
  ctx.fillStyle = '#45405b'
  ctx.beginPath()
  ctx.moveTo(0, 83)
  ctx.lineTo(0, 61)
  ctx.quadraticCurveTo(21, 51, 42, 62)
  ctx.quadraticCurveTo(53, 72, 72, 66)
  ctx.quadraticCurveTo(92, 69, 117, 83)
  ctx.fill()
  ctx.fillStyle = '#665167'
  ctx.beginPath()
  ctx.moveTo(0, 83)
  ctx.lineTo(0, 75)
  ctx.quadraticCurveTo(38, 66, 62, 77)
  ctx.lineTo(100, 83)
  ctx.fill()
  for (let i = 0; i < 6; i++) {
    const x = 93 + i * 40, y = 34 + i % 3 * 6
    stroke(ctx, [[x - 5, y + 1], [x - 2, y], [x, y + 2], [x + 3, y - 1], [x + 6, y - 1]], '#ffe1b478', 1)
  }

  const water = ctx.createLinearGradient(0, 83, 0, HEIGHT)
  water.addColorStop(0, bonus ? '#443669' : '#24485f')
  water.addColorStop(.55, bonus ? '#244464' : '#173f58')
  water.addColorStop(1, '#0c3345')
  ctx.fillStyle = water
  ctx.fillRect(0, 83, WIDTH, HEIGHT - 83)
  ctx.fillStyle = '#edaa8a90'
  ctx.fillRect(0, 83, WIDTH, 2)
  for (let i = 0; i < 44; i++) {
    const y = 90 + i * 7.8, width = 9 + i * .47
    const x = (i * i * 17 + 76) % WIDTH + Math.sin(time + i) * 12 - width / 2
    ctx.fillStyle = i < 14 && Math.abs(x - 360) < 75 ? '#ffd0a84a' : '#6bbcbf32'
    ctx.fillRect(x, y, width, y > 200 ? 2 : 1)
  }
  for (let i = 0; i < 10; i++) {
    const y = 110 + i * 35
    ctx.beginPath()
    for (let x = 0; x <= WIDTH; x += 6) ctx.lineTo(x, y + Math.sin(x / 49 - time * 1.15 + i * .54) * (2 + i * .4))
    ctx.strokeStyle = '#8adcdd1e'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function breaker(ctx, time, lane, depth) {
  const color = ctx.createLinearGradient(0, lane - 10, 0, lane + depth)
  color.addColorStop(0, '#69ded58c')
  color.addColorStop(.27, '#279ca99e')
  color.addColorStop(1, '#0b324d35')
  ctx.beginPath()
  for (let x = 0; x <= WIDTH; x += 4) ctx.lineTo(x, waterline(x, time, lane))
  ctx.lineTo(WIDTH, lane + depth)
  ctx.lineTo(0, lane + depth)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    for (let x = 0; x <= WIDTH; x += 4) ctx.lineTo(x, waterline(x, time - i * .052, lane) + 3 + i * 6)
    ctx.strokeStyle = ['#c9fae91c','#89e5d966','#4fc4cc4f'][i]
    ctx.lineWidth = 2.3 - i * .4
    ctx.stroke()
  }
}

export function drawPatrol(ctx, game, reduced) {
  const time = reduced ? 0 : game.oceanTime
  const bonus = game.stage === 'bonus'
  horizon(ctx, time, bonus)
  breaker(ctx, time, SURF_Y - 35, 58)
  breaker(ctx, time, SURF_Y, 68)
  if (game.ride === 'coop') breaker(ctx, time, SURF_Y + 26, 49)

  for (const foe of game.foes) {
    if (!foe.visible) continue
    ctx.save()
    ctx.translate(foe.x, foe.y)
    if (bonus) {
      ctx.rotate(Math.sin(time * 5 + foe.id) * .27)
      shell(ctx)
    } else {
      if (foe.dive) {
        ellipse(ctx, -4, -22, 5, 3, '#b9ffeb5c')
        ellipse(ctx, 5, -31, 2.6, 2.6, '#b9ffeb86')
      }
      const ripple = Math.sin(time * 5 + foe.col) * 5
      creatures[foe.row](ctx, ripple)
    }
    ctx.restore()
  }
  for (const shot of game.shots) {
    ctx.save()
    ctx.translate(shot.x, shot.y)
    ctx.rotate(-Math.PI / 2 + Math.sin(shot.age * 24) * .38)
    board(ctx, jerseys[shot.owner], .57)
    ctx.restore()
  }
  for (const shot of game.enemyShots) {
    ellipse(ctx, shot.x, shot.y, 4.7, 5.9, '#ffb4c7')
    ellipse(ctx, shot.x + 1, shot.y - 1.5, 1.7, 1.7, '#fff3d3')
  }
  for (const surfer of game.surfers) {
    const position = reduced ? {...surfer, y: waterline(surfer.x, 0, surfer.lane)} : surfer
    ride(ctx, position, time, game.shield, reduced)
  }
  for (const spark of game.sparks) {
    ctx.globalAlpha = Math.min(1, spark.life * 3)
    ellipse(ctx, spark.x, spark.y, 2, 2, spark.color)
  }
  ctx.globalAlpha = 1
  if (game.intermission) banner(ctx, game.result, false)
  else if (bonus && game.clock < 1.35) banner(ctx, 'Bonus set · Catch the shells', true)
}

function banner(ctx, text, upper) {
  const y = upper ? 90 : 298
  ctx.fillStyle = '#1e1739e8'
  ctx.beginPath()
  ctx.roundRect(72, y, WIDTH - 144, 40, 9)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 18px system-ui'
  ctx.fillStyle = '#ffe1b3'
  ctx.fillText(text, WIDTH / 2, y + 20)
}
