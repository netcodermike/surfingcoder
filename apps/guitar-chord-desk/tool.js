const pitches = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B']
const tuning = [40,45,50,55,59,64]
const qualities = {
  'Major': { suffix: '', intervals: [0,4,7], e: [0,2,2,1,0,0], a: [-1,0,2,2,2,0] },
  'Minor': { suffix: 'm', intervals: [0,3,7], e: [0,2,2,0,0,0], a: [-1,0,2,2,1,0] },
  'Dominant 7': { suffix: '7', intervals: [0,4,7,10], e: [0,2,0,1,0,0], a: [-1,0,2,0,2,0] },
}
const open = {
  'C Major': [-1,3,2,0,1,0], 'D Major': [-1,-1,0,2,3,2],
  'E Major': [0,2,2,1,0,0], 'G Major': [3,2,0,0,0,3], 'A Major': [-1,0,2,2,2,0],
  'A Minor': [-1,0,2,2,1,0], 'D Minor': [-1,-1,0,2,3,1], 'E Minor': [0,2,2,0,0,0],
  'A Dominant 7': [-1,0,2,0,2,0], 'B Dominant 7': [-1,2,1,2,0,2],
  'C Dominant 7': [-1,3,2,3,1,0], 'D Dominant 7': [-1,-1,0,2,1,2],
  'E Dominant 7': [0,2,0,1,0,0], 'G Dominant 7': [3,2,0,0,0,1],
}

export function mount({ context: ctx, choice, button, detail, status, exportAs }) {
  let root = 'C', quality = 'Major', shape = 'Lowest position', frets, audio
  function voice() {
    const pitch = pitches.indexOf(root)
    const eFret = (pitch - 4 + 12) % 12, aFret = (pitch - 9 + 12) % 12
    const base = qualities[quality]
    const e = base.e.map(fret => fret < 0 ? -1 : fret + eFret)
    const a = base.a.map(fret => fret < 0 ? -1 : fret + aFret)
    if (shape === 'E shape') return e
    if (shape === 'A shape') return a
    return open[`${root} ${quality}`] ?? (eFret < aFret ? e : a)
  }
  const note = (fret, index) => pitches[(tuning[index]+fret)%12]
  function draw() {
    frets = voice()
    const played = frets.filter(fret => fret >= 0)
    const first = Math.min(...played) > 0 ? Math.min(...played) : 1
    const board = ctx.createLinearGradient(0,0,1000,640)
    board.addColorStop(0,'#22283c'); board.addColorStop(1,'#30243f')
    ctx.fillStyle = board; ctx.fillRect(0,0,1000,640)
    ctx.font = 'bold 88px Segoe UI'
    ctx.fillStyle = '#f7e5ce'
    ctx.fillText(root + qualities[quality].suffix,72,132)
    ctx.font = '24px Segoe UI'
    ctx.fillStyle = '#c9bed6'
    ctx.fillText(quality,75,180)
    ctx.fillText('Standard tuning',75,243)
    ctx.fillText('E  A  D  G  B  E',75,279)
    ctx.fillStyle = '#7ee2c9'
    const chordNotes = qualities[quality].intervals.map(interval => pitches[(pitches.indexOf(root)+interval)%12])
    ctx.fillText(chordNotes.join('  ·  '),75,352)
    const left = 420, top = 115, gap = 76, step = 92
    ctx.fillStyle = '#49364b'; ctx.fillRect(left,top,gap*5,step*4)
    for (let fret = 0; fret <= 4; fret++) {
      ctx.fillStyle = fret === 0 && first === 1 ? '#f2d4b7' : '#aa94b7'
      ctx.fillRect(left-2,top+step*fret,gap*5+4,fret === 0 && first === 1 ? 6 : 2)
    }
    ctx.textAlign = 'center'
    for (const [index,fret] of frets.entries()) {
      const x = left+gap*index
      ctx.fillStyle = '#e0bdad'
      ctx.fillRect(x,top,3-index*.25,step*4)
      ctx.font = '22px Segoe UI'
      ctx.fillStyle = '#dacde5'
      ctx.fillText(fret < 0 ? '×' : fret === 0 ? '○' : String(fret),x,top-22)
      if (fret > 0) {
        const y = top+(fret-first+.5)*step
        ctx.fillStyle = note(fret,index) === root ? '#f5b481' : '#78d7c7'
        ctx.beginPath(); ctx.arc(x,y,18,0,Math.PI*2); ctx.fill()
      }
      ctx.fillStyle = '#e0d4e9'
      ctx.fillText(fret < 0 ? '–' : note(fret,index),x,top+step*4+40)
    }
    ctx.textAlign = 'start'
    detail(`${root}${qualities[quality].suffix} · Fret ${first} diagram`)
  }
  const roots = choice('Root',pitches,root,value => { root = value; draw() })
  choice('Chord quality',Object.keys(qualities),quality,value => { quality = value; draw() })
  choice('Voicing',['Lowest position','E shape','A shape'],shape,value => { shape = value; draw() })
  button('Play chord', async () => {
    audio ??= new AudioContext()
    await audio.resume()
    for (const [index,fret] of frets.entries()) {
      if (fret < 0) continue
      const oscillator = audio.createOscillator(), gain = audio.createGain()
      const start = audio.currentTime + index*.035
      oscillator.type = 'triangle'
      oscillator.frequency.value = 440*2**((tuning[index]+fret-69)/12)
      gain.gain.setValueAtTime(.0001,start)
      gain.gain.exponentialRampToValueAtTime(.12,start+.015)
      gain.gain.exponentialRampToValueAtTime(.0001,start+.85)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(start); oscillator.stop(start+.87)
    }
    status(`Playing ${root}${qualities[quality].suffix}`)
  })
  exportAs(() => `${root}${qualities[quality].suffix}\nStandard tuning, low E to high E\n${frets.map(fret=>fret<0?'x':fret).join('  ')}\n`,'txt')
  draw()
  return ({ update, assert }) => {
    update(roots,'G')
    assert(frets.join(',') === '3,2,0,0,0,3', 'Incorrect open G voicing')
    const voiced = new Set(frets.flatMap((fret,index) => fret < 0 ? [] : [note(fret,index)]))
    assert(['G','B','D'].every(pitch => voiced.has(pitch)), 'G major is missing a chord tone')
  }
}
