export function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export function polygon(ctx, color, points) {
  ctx.beginPath()
  ctx.moveTo(...points[0])
  for (const point of points.slice(1)) ctx.lineTo(...point)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

export function landscape(surface) {
  const art = surface(1200, 800)
  const ctx = art.getContext('2d')
  const sky = ctx.createLinearGradient(0, 0, 0, 800)
  for (const [at, color] of [[0,'#1c254b'], [.38,'#725887'], [.64,'#f09f94'], [.81,'#f0c09c'], [1,'#946485']]) sky.addColorStop(at,color)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1200, 800)
  const sun = ctx.createRadialGradient(880, 235, 35, 880, 235, 155)
  sun.addColorStop(0, '#ffe5b4')
  sun.addColorStop(.48, '#ffd19ab5')
  sun.addColorStop(1, '#ffa68100')
  ctx.fillStyle = sun
  ctx.fillRect(695, 50, 370, 370)
  const rand = random(72)
  for (let band = 0; band < 6; band++) {
    const colors = ['#665e88','#53517a','#454869','#344461','#264458','#20394c']
    const ridge = Array.from({length: 25}, (_, index) => [index * 50,
      330 + band * 61 - Math.sin(index * .49 + band * 1.48) * (108 - band * 9) + rand() * 48])
    polygon(ctx, colors[band], [[0,800], ...ridge, [1200,800]])
  }
  const lake = ctx.createLinearGradient(0, 620, 0, 800)
  lake.addColorStop(0, '#ad7893')
  lake.addColorStop(1, '#315264')
  polygon(ctx, lake, [[620,640],[799,618],[1042,643],[1200,628],[1200,800],[235,800]])
  for (let line = 0; line < 290; line++) {
    const y = 643 + rand() * 157
    const x = 620 - (y - 645) * 1.6 + rand() * (550 + y - 645)
    ctx.fillStyle = ['#f6c09b55','#d39fca44','#354b7666'][line % 3]
    ctx.fillRect(x, y, 3 + rand() * (y - 630) / 3, 1.2)
  }
  for (let tree = 0; tree < 29; tree++) {
    const x = rand() * 470, y = 770 + rand() * 65, height = 30 + rand() * 170
    const shade = tree % 2 ? '#182c3b' : '#203748'
    for (let branch = 0; branch < 4; branch++) {
      const top = y - height + branch * height / 6
      const spread = height * (.08 + branch * .037)
      polygon(ctx, shade, [[x,top],[x-spread,top+height*.52],[x+spread,top+height*.52]])
    }
  }
  return art
}

export function fit(ctx, image, width, height) {
  const ratio = Math.min(width / image.width, height / image.height)
  const w = image.width * ratio, h = image.height * ratio
  const x = (width - w) / 2, y = (height - h) / 2
  ctx.drawImage(image, x, y, w, h)
  return { x, y, w, h }
}
