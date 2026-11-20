export const WIDTH = 480
export const HEIGHT = 550
export const SURF_Y = 474
export const RIDES = {solo: 1, tandem: 2, coop: 2}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const overlaps = (a, b, x, y) => Math.abs(a.x - b.x) < x && Math.abs(a.y - b.y) < y
const reefNames = ['Outer Reef', 'Riptide Alley', 'The Point', 'Coral Break']

export const waterline = (x, time, baseline = SURF_Y) =>
  baseline + 8 * Math.sin(x / 42 - time * 2.3) + 3 * Math.sin(x / 22 + time * 1.4)

export function stageName(wave) {
  if (wave % 3 === 0) return wave % 6 === 0 ? 'Glass Barrel' : 'Shell Run'
  return reefNames[(wave - 1 - Math.floor(wave / 3)) % reefNames.length]
}

export function startWave(game) {
  game.stage = game.wave % 3 === 0 ? 'bonus' : 'reef'
  game.clock = 0
  game.nextDive = 2.3
  game.nextShot = 1.6
  game.shots = []
  game.enemyShots = []
  game.shells = 0
  game.foes = game.stage === 'bonus'
    ? Array.from({length: 21}, (_, id) => ({
        id, flight: Math.floor(id / 7), delay: Math.floor(id / 7) * 3.45 + id % 7 * .23,
        x: -40, y: 92, visible: false,
      }))
    : Array.from({length: 28}, (_, id) => {
        const row = Math.floor(id / 7), col = id % 7
        return {id, row, col, x: 78 + 54 * col, y: 102 + 39 * row, dive: null, visible: true}
      })
}

export function createGame(ride = 'solo') {
  if (!Object.hasOwn(RIDES, ride)) throw new RangeError('Unknown ride mode')
  const count = RIDES[ride]
  const surfers = Array.from({length: count}, (_, id) => {
    const x = count === 1 ? WIDTH / 2 : WIDTH / 2 + (id ? 29 : -29)
    const lane = ride === 'coop' && id === 1 ? SURF_Y + 26 : SURF_Y
    return {id, x, y: waterline(x, 0, lane), lane, facing: id ? -1 : 1, lean: 0, cooldown: 0}
  })
  const game = {ride, surfers, shots: [], enemyShots: [], sparks: [],
    score: 0, lives: 3, wave: 1, shield: 0, oceanTime: 0, over: false, intermission: 0, result: ''}
  startWave(game)
  return game
}

function spawnSparks(game, x, y, color) {
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * 2 * Math.PI, speed = 36 + i % 4 * 19
    game.sparks.push({x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45, color})
  }
}

function guideSurfers(game, inputs, dt, events) {
  for (const surfer of game.surfers) {
    const action = inputs[game.ride === 'coop' ? surfer.id : 0]
    const direction = action?.direction ?? 0
    // Shared control keeps the boards apart at the edges as well as in open water.
    const stagger = game.ride === 'tandem' ? (surfer.id ? 29 : -29) : 0
    surfer.x = clamp(surfer.x + direction * 316 * dt, 31 + Math.abs(stagger) + stagger,
      WIDTH - 31 - Math.abs(stagger) + stagger)
    surfer.y = waterline(surfer.x, game.oceanTime, surfer.lane)
    if (direction) surfer.facing = direction
    surfer.lean += (direction - surfer.lean) * Math.min(1, dt * 15)
    surfer.cooldown -= dt
    if (action?.fire && !game.intermission && surfer.cooldown <= 0) {
      game.shots.push({x: surfer.x, y: surfer.y - 29, owner: surfer.id, age: 0})
      surfer.cooldown = .22
      if (game.ride !== 'tandem' || surfer.id === 0) events.push('throw')
    }
  }
}

function swimReef(game, random) {
  const {clock, wave, foes, surfers} = game
  for (const foe of foes) {
    const homeX = 78 + foe.col * 54 + Math.sin(clock * (1.05 + wave * .035)) * 31
    const homeY = 102 + foe.row * 39 + Math.sin(clock * 2.2 + foe.col * .65) * 8
    const elapsed = foe.dive ? clock - foe.dive.start : 3
    if (elapsed >= 2.45) {
      foe.dive = null
      foe.x = homeX
      foe.y = homeY
    } else {
      const t = elapsed / 2.45, bend = Math.sin(Math.PI * t)
      foe.y = homeY + (foe.dive.depth - homeY) * bend ** 1.65
      foe.x = clamp(homeX + (foe.dive.x - homeX) * bend + Math.sin(Math.PI * 2 * t) * 65, 20, WIDTH - 20)
    }
  }
  if (foes.length && clock >= game.nextDive) {
    const ready = foes.filter(foe => !foe.dive)
    const foe = ready[Math.floor(random() * ready.length)]
    const surfer = surfers[Math.floor(random() * surfers.length)]
    if (foe) foe.dive = {start: clock, x: surfer.x, depth: surfer.lane + 20}
    game.nextDive += Math.max(.79, 2.85 - wave * .21)
  }
  if (foes.length && clock >= game.nextShot) {
    const front = new Map()
    for (const foe of foes) {
      if (!front.has(foe.col) || front.get(foe.col).y < foe.y) front.set(foe.col, foe)
    }
    const shooter = [...front.values()][Math.floor(random() * front.size)]
    const surfer = surfers[Math.floor(random() * surfers.length)]
    game.enemyShots.push({x: shooter.x, y: shooter.y + 12, vx: clamp((surfer.x - shooter.x) * .25, -80, 80)})
    game.nextShot += Math.max(.28, 1.29 - wave * .09)
  }
}

function swimBonus(game) {
  const glass = game.wave % 6 === 0
  game.foes = game.foes.filter(foe => {
    const progress = (game.clock - foe.delay) / 4
    if (progress >= 1) return false
    foe.visible = progress >= 0
    if (foe.visible) {
      const sign = foe.flight % 2 ? -1 : 1
      foe.x = WIDTH / 2 + sign * (progress - .5) * (WIDTH + 80)
      foe.y = 120 + foe.flight * 31 + (glass
        ? Math.sin(progress * 2 * Math.PI) * 76
        : Math.sin(progress * Math.PI) * 132)
    }
    return true
  })
}

function scoreHits(game, events) {
  game.shots = game.shots.filter(shot => {
    const target = game.foes.find(foe => foe.visible && overlaps(shot, foe, 19, 15))
    if (!target) return true
    game.foes.splice(game.foes.indexOf(target), 1)
    const bonus = game.stage === 'bonus'
    if (bonus) game.shells++
    game.score += bonus ? 150 : target.dive ? 300 : [160, 120, 100, 80][target.row]
    spawnSparks(game, target.x, target.y, bonus ? '#ffe2a0' : ['#c9b0ff','#f6a5d0','#fac58a','#93e6d4'][target.row])
    events.push(bonus ? 'shell' : 'hit')
    return false
  })
}

function checkDamage(game, events) {
  if (game.shield || game.stage === 'bonus') return
  for (const surfer of game.surfers) {
    const hitShot = game.enemyShots.find(shot => overlaps(shot, surfer, 16, 18))
    const hitFoe = game.foes.some(foe => foe.dive && overlaps(foe, surfer, 22, 21))
    if (!hitShot && !hitFoe) continue
    if (hitShot) game.enemyShots.splice(game.enemyShots.indexOf(hitShot), 1)
    game.lives--
    game.shield = 1.65
    spawnSparks(game, surfer.x, surfer.y, '#ffbe91')
    events.push('damage')
    game.over = game.lives === 0
    return
  }
}

export function update(game, inputs, dt, random = Math.random) {
  if (game.over) return []
  const events = []
  game.clock += dt
  game.oceanTime += dt
  game.shield = Math.max(0, game.shield - dt)
  guideSurfers(game, inputs, dt, events)
  if (game.intermission > 0) {
    game.intermission = Math.max(0, game.intermission - dt)
    if (game.intermission === 0) {
      game.wave++
      startWave(game)
    }
  } else {
    if (game.stage === 'bonus') swimBonus(game)
    else swimReef(game, random)
    for (const shot of game.shots) {
      shot.age += dt
      shot.y -= 508 * dt
    }
    game.shots = game.shots.filter(shot => shot.y > -15)
    for (const shot of game.enemyShots) {
      shot.y += (158 + Math.min(game.wave, 12) * 15) * dt
      shot.x += shot.vx * dt
    }
    game.enemyShots = game.enemyShots.filter(shot => shot.y < HEIGHT + 8 && shot.x > -5 && shot.x < WIDTH + 5)
    scoreHits(game, events)
    if (!game.foes.length) {
      const bonus = game.stage === 'bonus'
      const perfect = bonus && game.shells === 21
      game.result = bonus ? (perfect ? 'Perfect run · +2,100' : game.shells + ' of 21 shells') : 'Reef cleared'
      game.score += bonus ? (perfect ? 2100 : 0) : 400 * game.wave
      game.intermission = 1.6
      game.enemyShots = []
      game.shots = []
      events.push('wave')
    } else checkDamage(game, events)
  }
  for (const spark of game.sparks) {
    spark.x += spark.vx * dt
    spark.y += spark.vy * dt
    spark.life -= dt
  }
  game.sparks = game.sparks.filter(spark => spark.life > 0)
  return events
}
