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

function creature(ctx, row, animation) {
  ctx.strokeStyle = outline
  ctx.lineWidth = 2.1
  if (row === 0) {
    ctx.fillStyle = '#bbacee'
    ctx.beginPath()
    ctx.moveTo(-21, -4)
    ctx.quadraticCurveTo(-10, -6 - animation, -5, -10)
    ctx.quadraticCurveTo(0, -16, 5, -10)
    ctx.quadraticCurveTo(12, -6 + animation, 21, -4)
    ctx.quadraticCurveTo(13, 3, 4, 7)
    ctx.quadraticCurveTo(3, 12, -7, 17)
    ctx.quadraticCurveTo(-3, 11, -5, 7)
    ctx.quadraticCurveTo(-16, 1, -21, -4)
    ctx.fill()
    ctx.stroke()
    ellipse(ctx, 0, -1, 5, 5, '#756eb0')
  } else if (row === 1) {
    ctx.lineCap = 'round'
    for (const x of [-9, -3, 3, 9]) {
      ctx.beginPath()
      ctx.moveTo(x, 2)
      ctx.quadraticCurveTo(x + animation * .6, 11, x * 1.54, 15 - Math.abs(x) * .4)
      ctx.strokeStyle = '#ef93cc'
      ctx.lineWidth = 3
      ctx.stroke()
    }
    ctx.fillStyle = '#f09ccc'
    ctx.beginPath()
    ctx.moveTo(-13, 4)
    ctx.quadraticCurveTo(-10, -8, 0, -14)
    ctx.quadraticCurveTo(11, -8, 13, 4)
    ctx.quadraticCurveTo(0, 11, -13, 4)
    ctx.fill()
    ctx.strokeStyle = outline
    ctx.stroke()
  } else if (row === 2) {
    ctx.fillStyle = '#ffc18d'
    ctx.beginPath()
    for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16, radius = i % 2 ? 12 : 16
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius * .9)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ellipse(ctx, 0, 4, 8, 5, '#fff0be')
  } else {
    ctx.fillStyle = '#73e1cd'
    ctx.beginPath()
    ctx.moveTo(-17, 3)
    ctx.quadraticCurveTo(-6, -16, 10, -5)
    ctx.lineTo(19, -9 + animation * .65)
    ctx.lineTo(16, 1)
    ctx.lineTo(20, 10 + animation * .65)
    ctx.lineTo(8, 7)
    ctx.quadraticCurveTo(-6, 14, -17, 3)
    ctx.fill()
    ctx.stroke()
    ellipse(ctx, 1, 2, 4, 6.8, '#3a968b')
    ellipse(ctx, -9, 1, 2, 2, outline)
    return
  }
  ellipse(ctx, -4, -2, 1.9, 2.2, outline)
  ellipse(ctx, 4, -2, 1.9, 2.2, outline)
}

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
      creature(ctx, foe.row, ripple)
    }
    ctx.restore()
  }
  for (const shot of game.shots) {
    ctx.save()
    ctx.translate(shot.x, shot.y)
    ctx.rotate(-Math.PI / 2 + Math.sin(shot.age * 24) * .38)
    board(ctx, jerseys[shot.owner], .38)
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
