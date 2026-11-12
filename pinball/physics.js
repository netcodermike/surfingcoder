export const WIDTH = 510
export const HEIGHT = 730
export const STEP = 1 / 240
export const BUMPERS = [
  { x: 143, y: 228, r: 33, label: '01', color: '#ff9ba7' },
  { x: 256, y: 168, r: 38, label: '02', color: '#9cf6e2' },
  { x: 355, y: 254, r: 32, label: '03', color: '#e5aeff' },
]
export const WALLS = [
  [23, 565, 23, 140], [23, 140, 48, 82], [48, 82, 98, 44], [98, 44, 172, 29],
  [172, 29, 361, 29], [361, 29, 423, 45], [423, 45, 475, 86],
  [475, 86, 493, 129], [493, 129, 493, 703], [448, 149, 448, 702],
  [23, 565, 66, 653], [66, 653, 122, 700], [122, 700, 205, 730],
  [448, 562, 413, 653], [413, 653, 355, 700], [355, 700, 278, 730],
  [48, 475, 93, 545, 'sling'], [93, 545, 116, 566, 'sling'],
  [420, 478, 381, 544, 'sling'], [381, 544, 357, 566, 'sling'],
  [185, 54, 185, 98], [265, 54, 265, 94], [345, 54, 345, 94],
]
export const LANES = [145, 225, 305]
const RADIUS = 8
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value))

export function createGame(best = 0) {
  return {
    score: 0, best, number: 1, mode: 'ready', charge: 0, multiplier: 0,
    lit: [false, false, false], flash: [0, 0, 0], laneFlash: [0, 0, 0],
    message: 'Hold and release Launch to serve.', elapsed: 0,
    ball: { x: 471, y: 652, vx: 0, vy: 0 }, effects: [],
    flippers: [
      { x: 139, y: 615, rest: .37, angle: .37, active: -.57, length: 83 },
      { x: 337, y: 615, rest: Math.PI - .37, angle: Math.PI - .37, active: Math.PI + .57, length: 83 },
    ],
  }
}

export function serve(game) {
  if (game.mode !== 'ready') return false
  const power = 1000 + game.charge * 325
  Object.assign(game.ball, { x: 476, y: 652, vx: -12, vy: -power })
  game.charge = 0
  game.mode = 'play'
  game.message = 'Hit all three wave bumpers.'
  return true
}

function addScore(game, value, sound) {
  game.score += value * (game.multiplier > 0 ? 2 : 1)
  game.best = Math.max(game.best, game.score)
  game.effects.push(sound)
}

function circleCollision(ball, x, y, reach, bounce, motionX = 0, motionY = 0) {
  const dx = ball.x - x, dy = ball.y - y
  const length = Math.hypot(dx, dy)
  if (length >= reach) return false
  const nx = length > .001 ? dx / length : 0
  const ny = length > .001 ? dy / length : -1
  ball.x += nx * (reach - length + .03)
  ball.y += ny * (reach - length + .03)
  const approach = (ball.vx - motionX) * nx + (ball.vy - motionY) * ny
  if (approach >= 0) return false
  const impulse = -(1 + bounce) * approach
  ball.vx += nx * impulse
  ball.vy += ny * impulse
  return true
}

function segmentCollision(ball, x, y, ex, ey, width, bounce, spin = 0) {
  const dx = ex - x, dy = ey - y
  const t = clamp(((ball.x - x) * dx + (ball.y - y) * dy) / (dx * dx + dy * dy), 0, 1)
  return circleCollision(ball, x + t * dx, y + t * dy, RADIUS + width, bounce, -t * dy * spin, t * dx * spin)
}

export function flipperTip(flipper) {
  return [flipper.x + Math.cos(flipper.angle) * flipper.length, flipper.y + Math.sin(flipper.angle) * flipper.length]
}

function drain(game) {
  game.multiplier = 0
  game.lit.fill(false)
  game.effects.push('drain')
  if (game.number === 3) {
    game.mode = 'over'
    game.message = 'Game over. Start a new game to ride again.'
  } else {
    game.number++
    game.mode = 'ready'
    Object.assign(game.ball, { x: 471, y: 652, vx: 0, vy: 0 })
    game.message = 'Hold and release Launch for the next ball.'
  }
}

export function advance(game, input, dt = STEP) {
  game.elapsed += dt
  game.flash = game.flash.map(value => Math.max(0, value - dt))
  game.laneFlash = game.laneFlash.map(value => Math.max(0, value - dt))
  if (game.multiplier > 0) {
    game.multiplier = Math.max(0, game.multiplier - dt)
    if (game.multiplier === 0) {
      game.lit.fill(false)
      game.message = 'Set over. Hit all three wave bumpers again.'
    }
  }
  for (const [index, flipper] of game.flippers.entries()) {
    const pressed = index === 0 ? input.left : input.right
    const last = flipper.angle
    flipper.angle += clamp((pressed ? flipper.active : flipper.rest) - last, -dt * 25, dt * 25)
    flipper.spin = (flipper.angle - last) / dt
  }
  if (game.mode === 'ready') {
    if (input.launch) game.charge = Math.min(1, game.charge + dt * 1.3)
    return
  }
  if (game.mode !== 'play') return

  const { ball } = game
  const previousY = ball.y
  ball.vy += 850 * dt
  ball.vx *= .9991
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > 1460) { ball.vx *= 1460 / speed; ball.vy *= 1460 / speed }
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  for (const [x, y, ex, ey, material] of WALLS) {
    const sling = material === 'sling'
    if (segmentCollision(ball, x, y, ex, ey, 2, sling ? 1.1 : .79) && sling) {
      ball.vy -= 90
      addScore(game, 25, 'sling')
    }
  }
  BUMPERS.forEach((bumper, index) => {
    if (!circleCollision(ball, bumper.x, bumper.y, bumper.r + RADIUS, 1.12)) return
    if (game.flash[index] > .15) return
    game.flash[index] = .25
    const dx = ball.x - bumper.x, dy = ball.y - bumper.y
    const length = Math.hypot(dx, dy)
    ball.vx += dx / length * 155
    ball.vy += dy / length * 155
    addScore(game, 100, 'bumper')
    game.lit[index] = true
    if (!game.multiplier && game.lit.every(Boolean)) {
      game.score += 300
      game.best = Math.max(game.best, game.score)
      game.multiplier = 10
      game.message = '2× set is on. Shoot a top lane to extend it.'
      game.effects.push('set')
    }
  })
  game.flippers.forEach(flipper => {
    if (segmentCollision(ball, flipper.x, flipper.y, ...flipperTip(flipper), 8, .58, flipper.spin) &&
        Math.abs(flipper.spin) > 10) game.effects.push('flip')
  })
  if (previousY >= 92 && ball.y < 92) {
    const index = LANES.findIndex(x => Math.abs(x - ball.x) < 28)
    if (index >= 0 && game.laneFlash[index] === 0) {
      game.laneFlash[index] = .8
      addScore(game, 150, 'lane')
      if (game.multiplier > 0) game.multiplier = Math.min(12, game.multiplier + 3)
    }
  }
  if (ball.x > 457 && ball.y > 679 && ball.vy > 0) {
    game.mode = 'ready'
    Object.assign(ball, { x: 471, y: 652, vx: 0, vy: 0 })
    game.message = 'Ball returned to the launch lane.'
  } else if (ball.y > HEIGHT + 16 || ball.x < -20 || ball.x > WIDTH + 20) {
    drain(game)
  }
}
