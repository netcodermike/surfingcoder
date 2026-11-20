const bodies = {
  'Double cut': 'M 426 257 C 376 263 344 202 292 180 C 245 160 234 201 250 244 C 270 300 227 320 192 334 C 118 360 91 433 123 493 C 161 562 290 570 359 527 C 420 489 394 431 425 406 C 459 382 490 408 488 372 C 485 344 445 336 426 342 Z',
  'Single cut': 'M 426 255 C 373 260 361 206 296 192 C 233 179 212 234 236 289 C 250 323 220 324 186 343 C 122 370 94 445 133 508 C 170 568 282 571 353 528 C 415 491 410 436 433 404 C 471 349 434 321 426 342 Z',
  'Offset': 'M 426 252 C 363 259 331 164 272 169 C 216 173 223 250 235 286 C 245 320 177 333 135 361 C 88 393 83 474 130 513 C 183 558 307 558 374 505 C 421 467 402 427 430 403 C 472 367 495 399 484 364 C 477 345 449 333 426 343 Z',
}

export function mount({ context: ctx, choice, color, range, detail }) {
  let body = 'Double cut', finish = '#d36973', guard = '#ece0b9', hardware = 'Chrome', pickups = 'Two humbuckers', frets = 22
  function rect(x,y,w,h,fill,r=4) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill()
  }
  function dot(x,y,r,fill) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill()
  }
  function draw() {
    const metal = { Chrome:'#dce3ea', Gold:'#edc578', Black:'#33333d' }[hardware]
    const shade = ctx.createLinearGradient(0,0,1000,640)
    shade.addColorStop(0,'#161826')
    shade.addColorStop(1,'#30223b')
    ctx.fillStyle = shade
    ctx.fillRect(0,0,1000,640)
    ctx.strokeStyle = '#84739720'
    ctx.lineWidth = 1
    for (let x = 30; x < 1000; x += 32) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,640); ctx.stroke()
    }
    for (let y = 0; y < 640; y += 32) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1000,y); ctx.stroke()
    }
    ctx.save()
    ctx.translate(-15,125)
    ctx.rotate(-.25)
    const silhouette = new Path2D(bodies[body])
    ctx.save()
    ctx.shadowColor = '#0a0914cc'; ctx.shadowBlur = 35; ctx.shadowOffsetY = 22
    ctx.fillStyle = finish; ctx.fill(silhouette)
    ctx.restore()
    ctx.save()
    ctx.clip(silhouette)
    const gloss = ctx.createLinearGradient(150,185,380,544)
    gloss.addColorStop(0,'#ffe4df66'); gloss.addColorStop(.46,'#ffffff00'); gloss.addColorStop(1,'#210e335c')
    ctx.fillStyle = gloss; ctx.fillRect(80,140,460,455)
    ctx.strokeStyle = '#ffffff4f'; ctx.lineWidth = 7; ctx.stroke(silhouette)
    ctx.restore()
    const plate = new Path2D('M 288 268 Q 366 262 425 270 L 425 348 Q 388 345 380 379 Q 370 418 335 427 Q 290 422 271 391 Q 247 354 267 320 Z')
    ctx.fillStyle = guard; ctx.fill(plate)
    ctx.strokeStyle = '#382739'; ctx.lineWidth = 2; ctx.stroke(plate)
    rect(410,271,358,73,'#6e4536')
    rect(420,275,340,65,'#2c2028')
    const head = new Path2D('M 747 271 L 782 264 L 822 245 Q 859 237 911 258 Q 930 272 905 288 L 806 342 L 748 344 Z')
    ctx.fillStyle = '#a57050'; ctx.fill(head)
    const positions = Array.from({length:frets},(_,i)=>748-(1-2**(-(i+1)/12))*410)
    for (const [index,x] of positions.entries()) {
      rect(x,276,2,63,metal,1)
      if ([2,4,6,8,11,14,16,18,20].includes(index)) {
        dot(x+6,308,3.5,'#dbc6b4')
        if (index === 11) dot(x+6,322,3.5,'#dbc6b4')
      }
    }
    const pickupPositions = pickups === 'Two humbuckers' ? [308,375] : [304,345,385]
    for (const x of pickupPositions) {
      rect(x,268,pickups === 'Two humbuckers' ? 26 : 16,81,'#28232c')
      for (let s = 0; s < 6; s++) dot(x+7,281+s*11,2.6,metal)
    }
    rect(268,270,17,75,metal)
    for (let s = 0; s < 6; s++) {
      const pegX = 788+s*19, pegY = 266-s*1.5
      dot(pegX,pegY,6,metal)
      ctx.strokeStyle = '#f2e3c4bf'; ctx.lineWidth = 1.45-s*.14
      ctx.beginPath(); ctx.moveTo(274,281+s*11); ctx.lineTo(757,284+s*9); ctx.lineTo(pegX,pegY); ctx.stroke()
    }
    for (const [x,y] of [[277,402],[305,443],[344,460]]) {
      dot(x,y,11,'#3f283c'); dot(x,y,8,metal)
    }
    ctx.restore()
    detail(`${body} · ${frets} frets`)
  }
  const shape = choice('Body shape',Object.keys(bodies),body,value => { body = value; draw() })
  color('Body finish',finish,value => { finish = value; draw() })
  color('Pickguard',guard,value => { guard = value; draw() })
  choice('Hardware',['Chrome','Gold','Black'],hardware,value => { hardware = value; draw() })
  choice('Pickups',['Two humbuckers','Three single coils'],pickups,value => { pickups = value; draw() })
  range('Fret count',19,24,frets,value => { frets = value; draw() })
  draw()
  return ({ update, assert }) => {
    update(shape,'Single cut')
    assert(body === 'Single cut','Body shape did not change')
  }
}
