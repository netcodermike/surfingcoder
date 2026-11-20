import { random, polygon } from './art.js'

export function mount({ context, surface, choice, range, color, button, group, pointer, detail }) {
  let layer = 'Ink', ink = '#ffb98b', size = 15, marks = [], current = null
  let showInk = true, showDetails = true, sample = true
  const initial = surface()
  const art = initial.getContext('2d')
  art.fillStyle = '#262143'
  art.fillRect(0,0,1000,640)
  const rand = random(32)
  for (let ring = 0; ring < 9; ring++) {
    const radius = 26 + ring * 18
    art.beginPath()
    art.arc(503,248,radius,0,2*Math.PI)
    art.strokeStyle = ['#ea91a8','#f5ad97','#ad95db'][ring%3]
    art.lineWidth = 2 + ring / 3
    art.stroke()
  }
  for (let shape = 0; shape < 7; shape++) {
    const colors = ['#8463a6','#63549b','#4a5493','#405c85','#38757d','#317274','#285e6c']
    const ridge = Array.from({length: 15}, (_,i) => [i*78,375 + 30*shape + Math.sin(i*.89 + shape*1.25)*37 + rand()*37])
    polygon(art,colors[shape],[[0,640],...ridge,[1000,640]])
  }
  for (let star = 0; star < 72; star++) {
    art.fillStyle = star % 4 ? '#e9c8e68b' : '#ffedbd'
    art.beginPath()
    art.arc(rand()*1000,rand()*340,.65+rand()*1.9,0,Math.PI*2)
    art.fill()
  }
  function draw() {
    context.fillStyle = '#262143'
    context.fillRect(0,0,1000,640)
    if (sample) context.drawImage(initial,0,0)
    for (const stroke of [...marks].sort((a,b) => Number(a.layer === 'Details') - Number(b.layer === 'Details'))) {
      if ((stroke.layer === 'Ink' && !showInk) || (stroke.layer === 'Details' && !showDetails)) continue
      const [x,y] = stroke.points[0]
      context.fillStyle = stroke.ink
      context.beginPath(); context.arc(x,y,stroke.size / 2,0,Math.PI*2); context.fill()
      context.strokeStyle = stroke.ink
      context.lineCap = context.lineJoin = 'round'
      context.lineWidth = stroke.size
      context.beginPath(); context.moveTo(x,y)
      for (const point of stroke.points.slice(1)) context.lineTo(...point)
      context.stroke()
    }
    detail(`${marks.length} strokes · 2 editable layers`)
  }
  choice('Active layer',['Ink','Details'],layer,value => { layer = value })
  color('Brush color',ink,value => { ink = value })
  range('Brush size',2,72,size,value => { size = value })
  const actions = group()
  button('Undo stroke', () => { marks.pop(); draw() }, actions)
  const sampleButton = button('Hide sample', () => {
    sample = !sample
    sampleButton.textContent = sample ? 'Hide sample' : 'Show sample'
    draw()
  }, actions)
  const inkButton = button('Hide ink', () => {
    showInk = !showInk
    inkButton.textContent = showInk ? 'Hide ink' : 'Show ink'
    draw()
  }, actions)
  const detailsButton = button('Hide details', () => {
    showDetails = !showDetails
    detailsButton.textContent = showDetails ? 'Hide details' : 'Show details'
    draw()
  }, actions)
  pointer((x,y) => {
    current = { layer, ink, size, points: [[x,y]] }
    marks.push(current); draw()
  }, (x,y) => { if (current) { current.points.push([x,y]); draw() } }, () => { current = null })
  draw()
  return ({ clickCanvas, assert }) => {
    clickCanvas(166,205)
    assert(marks.length === 1 && marks[0].layer === 'Ink', 'Brush stroke missing')
  }
}
