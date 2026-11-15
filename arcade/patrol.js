export const WIDTH = 480
export const HEIGHT = 550
export const SHIP_Y = 477
const clamp = (number,low,high) => Math.max(low,Math.min(high,number))
const overlaps = (a,b,x,y) => Math.abs(a.x-b.x)<x && Math.abs(a.y-b.y)<y

export function startWave(game) {
  game.foes = Array.from({length:28},(_,id) => ({
    id, row:Math.floor(id/7), col:id%7, x:78+54*(id%7), y:82+39*Math.floor(id/7), dive:null
  }))
  game.clock = 0
  game.nextDive = 2.2
  game.nextShot = 1.35
  game.enemyShots = []
}

export function createGame() {
  const game = {ship:{x:WIDTH/2,y:SHIP_Y},foes:[],shots:[],enemyShots:[],sparks:[],
    score:0,lives:3,wave:1,cooldown:0,shield:0,over:false,intermission:0}
  startWave(game)
  return game
}

function formation(foe,t,wave) {
  return {x:78+foe.col*54+Math.sin(t*(1.05+wave*.035))*32,
          y:82+foe.row*39+Math.sin(t*2.2+foe.col*.65)*7}
}
function spawnSparks(game,x,y,color) {
  for (let i=0; i<10; i++) {
    const angle = i/10 * 2*Math.PI
    const speed = 32+(i%4)*20
    game.sparks.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.45,color})
  }
}

export function update(game,input,dt,random = Math.random) {
  if (game.over) return []
  const events = []
  game.clock += dt
  game.shield = Math.max(0,game.shield-dt)
  game.cooldown -= dt
  game.ship.x = clamp(game.ship.x+input.direction*318*dt,18,WIDTH-18)
  if (input.fire && game.cooldown <= 0) {
    game.shots.push({x:game.ship.x,y:SHIP_Y-18})
    game.cooldown = .175
    events.push('fire')
  }
  for (const shot of game.shots) shot.y -= 520*dt
  game.shots = game.shots.filter(shot => shot.y>-12)
  for (const foe of game.foes) {
    const home = formation(foe,game.clock,game.wave)
    if (!foe.dive) Object.assign(foe,home)
    else {
      const elapsed = game.clock-foe.dive.start
      if (elapsed > 2.45) {
        foe.dive = null
        Object.assign(foe,home)
      } else {
        const t = elapsed/2.45
        foe.y = home.y + (510-home.y)*Math.sin(Math.PI*t)**1.65
        foe.x = clamp(home.x+(foe.dive.target-home.x)*Math.sin(Math.PI*t)+Math.sin(Math.PI*2*t)*65,17,WIDTH-17)
      }
    }
  }
  if (game.foes.length && game.clock >= game.nextDive) {
    const ready = game.foes.filter(foe => !foe.dive)
    const foe = ready[Math.floor(random()*ready.length)]
    if (foe) foe.dive = {start:game.clock,target:game.ship.x}
    game.nextDive += Math.max(.85,2.85-game.wave*.21)
  }
  if (game.foes.length && game.clock >= game.nextShot) {
    const front = [...new Set(game.foes.map(foe => foe.col))].map(col =>
      game.foes.filter(foe => foe.col===col).reduce((a,b) => a.y>b.y?a:b))
    const shooter = front[Math.floor(random()*front.length)]
    game.enemyShots.push({x:shooter.x,y:shooter.y+12,vx:clamp((game.ship.x-shooter.x)*.25,-80,80)})
    game.nextShot += Math.max(.28,1.23-game.wave*.09)
  }
  for (const shot of game.enemyShots) {
    shot.y += (158+Math.min(game.wave,12)*15)*dt
    shot.x += shot.vx*dt
  }
  game.enemyShots = game.enemyShots.filter(shot => shot.y<HEIGHT+8 && shot.x>-5 && shot.x<WIDTH+5)
  game.shots = game.shots.filter(shot => {
    const target = game.foes.find(foe => overlaps(shot,foe,17,13))
    if (!target) return true
    game.foes.splice(game.foes.indexOf(target),1)
    game.score += target.dive ? 300 : [160,120,100,80][target.row]
    spawnSparks(game,target.x,target.y,['#ffc88b','#e29fff','#a592ff','#8df8e0'][target.row])
    events.push('hit')
    return false
  })
  const hitShot = game.enemyShots.find(shot => overlaps(shot,game.ship,15,14))
  const hitFoe = game.foes.some(foe => foe.dive && overlaps(foe,game.ship,25,18))
  if (!game.shield && (hitShot || hitFoe)) {
    if (hitShot) game.enemyShots.splice(game.enemyShots.indexOf(hitShot),1)
    game.lives--
    game.shield = 1.8
    spawnSparks(game,game.ship.x,SHIP_Y,'#ffc28b')
    events.push('damage')
    if (game.lives === 0) game.over = true
  }
  if (!game.foes.length && !game.over) {
    if (game.intermission === 0) {
      game.intermission = 1.35
      game.enemyShots = []
      game.score += 400*game.wave
      events.push('wave')
    } else {
      game.intermission = Math.max(0,game.intermission-dt)
      if (game.intermission === 0) {
        game.wave++
        startWave(game)
      }
    }
  }
  for (const spark of game.sparks) {
    spark.x += spark.vx*dt
    spark.y += spark.vy*dt
    spark.life -= dt
  }
  game.sparks = game.sparks.filter(spark => spark.life>0)
  return events
}
