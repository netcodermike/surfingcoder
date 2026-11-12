function shape(ctx, color, commands, border) {
  const path = new Path2D(commands)
  ctx.fillStyle = color
  ctx.fill(path)
  if (border) {
    ctx.strokeStyle = border
    ctx.lineWidth = 2.5
    ctx.stroke(path)
  }
}

function disc(ctx, x, y, radius, color) {
  ctx.beginPath()
  ctx.arc(x,y,radius,0,Math.PI*2)
  ctx.fillStyle = color
  ctx.fill()
}

const art = {
  wave(ctx) {
    const sea = ctx.createLinearGradient(0,41,0,127)
    sea.addColorStop(0,'#8fede2')
    sea.addColorStop(1,'#176882')
    shape(ctx,sea,'M24 103 C50 103 48 56 92 44 C116 37 138 54 146 71 C120 61 110 76 114 88 C120 104 137 104 149 106 L149 123 L24 123 Z','#286581')
    shape(ctx,'#eaffed','M48 96 C62 72 73 54 95 46 C116 39 136 51 143 65 C124 54 105 57 95 65 C82 65 66 80 48 96 Z')
    for (const [x,y,r] of [[124,49,4],[134,45,3],[144,53,2]]) disc(ctx,x,y,r,'#459dae')
  },
  sunset(ctx) {
    const sky = ctx.createLinearGradient(0,25,0,122)
    sky.addColorStop(0,'#ffb466'); sky.addColorStop(1,'#d65775')
    disc(ctx,85,77,52,sky)
    ctx.save()
    ctx.beginPath();ctx.arc(85,77,52,0,Math.PI*2);ctx.clip()
    ctx.fillStyle = '#843b6d'
    for (let y=77; y<135; y+=10) ctx.fillRect(30,y,110,2+(y-77)/13)
    ctx.restore()
    shape(ctx,'#593764','M22 117 C47 107 66 112 83 115 C112 121 130 105 150 111 L148 122 C117 135 102 133 81 130 C55 126 40 130 22 131 Z')
  },
  board(ctx) {
    ctx.save();ctx.translate(84,80);ctx.rotate(.58)
    shape(ctx,'#ffd78d','M0 -61 C34 -43 32 20 9 56 Q0 62 -9 56 C-32 20 -34 -43 0 -61 Z','#84436b')
    shape(ctx,'#d76076','M0 -58 C7 -46 10 33 3 59 L-3 59 C-10 33 -7 -46 0 -58 Z')
    shape(ctx,'#83546a','M-17 24 Q0 33 17 24 L15 35 Q0 42 -15 35 Z')
    ctx.restore()
  },
  shell(ctx) {
    const pink = ctx.createLinearGradient(0,37,0,126)
    pink.addColorStop(0,'#ffd0b2'); pink.addColorStop(1,'#ba5c83')
    shape(ctx,pink,'M84 124 C70 122 52 105 40 91 C22 74 29 61 43 59 C37 46 54 37 65 45 C69 29 95 28 102 43 C116 34 131 45 127 58 C145 58 149 75 134 89 C121 103 102 123 84 124 Z','#934e75')
    ctx.strokeStyle = '#a25975';ctx.lineWidth = 2;ctx.lineCap = 'round'
    for (const x of [48,66,84,102,121]) {
      ctx.beginPath();ctx.moveTo(x,54 + Math.abs(x-84)/3);ctx.quadraticCurveTo(x,85,84,115);ctx.stroke()
    }
  },
  palm(ctx) {
    shape(ctx,'#99664d','M66 125 Q92 91 87 56 L96 53 Q102 92 83 127 Z','#784d56')
    shape(ctx,'#468d77','M91 58 Q48 27 30 61 Q56 48 86 66 Q42 57 44 93 Q61 68 91 70 Q66 22 105 28 Q91 39 98 59 Q120 25 144 49 Q120 45 100 66 Q132 53 148 79 Q122 66 99 73 Z','#336f67')
    disc(ctx,91,69,6,'#de9867')
    shape(ctx,'#a0758d','M41 131 Q85 111 131 131 Q85 143 41 131 Z')
  },
  pearl(ctx) {
    shape(ctx,'#94629a','M27 99 Q31 119 56 128 Q85 141 117 126 Q141 114 144 97 Q123 108 85 108 Q49 108 27 99 Z','#69416f')
    const shine = ctx.createRadialGradient(71,59,3,85,81,47)
    shine.addColorStop(0,'#fffef3'); shine.addColorStop(.52,'#c7f1de'); shine.addColorStop(1,'#a08bd7')
    disc(ctx,85,79,41,shine)
    shape(ctx,'#fdfcea','M124 29 L128 39 L138 43 L128 47 L124 57 L120 47 L110 43 L120 39 Z')
  },
}

export function drawSymbol(canvas, id, name) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0,0,canvas.width,canvas.height)
  ctx.save()
  ctx.shadowColor = '#5e3b6652'
  ctx.shadowBlur = 5
  ctx.shadowOffsetY = 3
  art[id](ctx)
  ctx.restore()
  if (name) canvas.setAttribute('aria-label', name)
}
