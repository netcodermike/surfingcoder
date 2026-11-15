import {createCheckers,checkersMoves,playCheckers,chooseCheckers} from './checkers.js'
import {createChinese,chineseMoves,playChinese,chooseChinese,holes} from './chinese.js'
import {createChess,chessMoves,playChess,chooseChess} from './chess-game.js'
import {createReversi,reversiMoves,playReversi,chooseReversi} from './reversi.js'
import {createFour,fourMoves,playFour,chooseFour} from './four.js'

const get = id => document.getElementById(id)
const board = get('board')
const picker = get('game-picker')
const promotion = get('promotion')
const colors = {1:'Sea Glass','-1':'Sunset'}
const blackChess = {p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}
const chessNames = {p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}
const standard = (create,moves,play,choose,help) => ({create,moves,play,choose,help})
const games = {
  'checkers':standard(createCheckers,checkersMoves,playCheckers,chooseCheckers,
    'Move diagonally on the dark squares. Captures are required. Keep jumping with the same piece when another capture is available. Reaching the far edge crowns a king and ends the turn.'),
  'chinese-checkers':standard(createChinese,chineseMoves,playChinese,chooseChinese,
    'Race all ten marbles to the opposite point. Move one space or hop over adjacent marbles of either color. Select a highlighted landing to take its hop route. Once a marble enters its destination triangle it stays inside.'),
  'chess':standard(createChess,chessMoves,playChess,chooseChess,
    'Checkmate the opposing king. Sea Glass plays White. Select a piece to see legal moves. Castling, en passant, underpromotion and automatic draw detection are supported.'),
  'reversi':standard(createReversi,reversiMoves,playReversi,chooseReversi,
    'Place a disc to trap one or more opposing discs in a straight line. Trapped discs flip to your color. A side with no move passes. The most discs wins when neither side can move.'),
  'four-in-a-row':standard(createFour,fourMoves,playFour,chooseFour,
    'Choose a column to drop a disc into its lowest open spot. The first side to connect four horizontally, vertically or diagonally wins.'),
}
const sessions = new Map()
let active, selected = null, last = [], legal = [], timer, ticket = 0, awaitingPromotion

function cancelTurn() {
  clearTimeout(timer)
  ticket++
  awaitingPromotion = null
  if (promotion.open) promotion.close()
}
function session() {
  return sessions.get(active)
}
function name(side) {
  return session().opponent === 'computer' ? side === 1 ? 'You' : 'Computer' : colors[side]
}
function isComputer() {
  return session().opponent === 'computer' && session().state.turn === -1
}
function gameId() {
  const key = location.hash.slice(1)
  return Object.hasOwn(games,key) ? key : 'checkers'
}
function reset(opponent) {
  cancelTurn()
  sessions.set(active,{state:games[active].create(),opponent,last:[]})
  selected = null
  last = []
  render()
}
function selectGame() {
  const next = gameId()
  if (next === active) return
  cancelTurn()
  active = next
  if (!sessions.has(active)) sessions.set(active,{state:games[active].create(),opponent:'computer',last:[]})
  selected = session().state.forced ?? null
  last = session().last
  get('opponent').value = session().opponent
  const link = picker.querySelector('a[href="#'+active+'"]')
  for (const item of picker.querySelectorAll('a')) item.removeAttribute('aria-current')
  link.setAttribute('aria-current','true')
  get('game-name').textContent = link.textContent
  get('rules').textContent = games[active].help
  render()
}

function apply(move, focus = move?.to) {
  const current = session(), rules = games[active]
  current.state = rules.play(current.state,move)
  current.last = last = move?.path ?? [move?.from,move?.to].filter(id => id !== undefined)
  selected = current.state.forced ?? null
  render(focus)
}
function queueTurn() {
  const current = session(), state = current.state
  if (state.result || (!isComputer() && (active !== 'chinese-checkers' || legal.length))) return
  const guard = ++ticket
  timer = setTimeout(() => {
    if (guard !== ticket || state !== session().state) return
    const move = isComputer() ? games[active].choose(state) : null
    if (move || active === 'chinese-checkers') {
      const focus = document.activeElement.closest('[data-cell]')
      apply(move, focus ? Number(focus.dataset.cell) : null)
    }
  },isComputer() ? 160 : 350)
}

function cellLabel(id, piece, state, cols, rows) {
  const coordinate = active === 'chinese-checkers' ? 'Hole '+(id+1)
    : 'abcdefgh'[id%cols]+(rows-Math.floor(id/cols))
  let occupant = 'empty'
  if (piece) {
    const side = active === 'chess' ? (piece.color === 'w' ? 1 : -1) : Math.sign(piece)
    occupant = colors[side]+' '+(active === 'chess' ? chessNames[piece.type] : Math.abs(piece) === 2 ? 'king' : 'piece')
  }
  const choice = !state.result && !isComputer() && legal.some(move =>
    active === 'four-in-a-row' ? move.col === id % cols : move.to === id && move.from === (selected ?? undefined))
  return coordinate+', '+occupant+(choice ? ', legal destination' : '')
}

function addStar() {
  const canvas = document.createElement('canvas')
  canvas.className = 'star-lines'
  canvas.width = 780
  canvas.height = 690
  canvas.setAttribute('aria-hidden','true')
  const ctx = canvas.getContext('2d')
  const x = i => 30+30*holes[i].x, y = i => 33+39*holes[i].y
  ctx.strokeStyle = '#d3bcfa28'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  holes.forEach((hole,id) => hole.neighbors.forEach(({adjacent}) => {
    if (adjacent > id) {ctx.moveTo(x(id),y(id)); ctx.lineTo(x(adjacent),y(adjacent))}
  }))
  ctx.stroke()
  board.append(canvas)
}

function decorateCell(button,id,piece,state,cols,rows) {
  const row = Math.floor(id/cols), col = id%cols
  const choosing = active === 'chess' || active === 'chinese-checkers' || active === 'checkers'
  const from = legal.some(move => move.from === id)
  const to = legal.some(move => move.to === id && (!choosing || move.from === selected))
  const classes = ['cell']
  if (active === 'chinese-checkers') {
    const {x,y,camp} = holes[id]
    button.style.setProperty('--x',(30+30*x)/780*100+'%')
    button.style.setProperty('--y',(33+39*y)/690*100+'%')
    if (camp) classes.push(camp === 1 ? 'camp-sea' : 'camp-sun')
  } else if (active === 'reversi') {
    if ([18,21,42,45].includes(id)) classes.push('grid-dot')
  } else if (active !== 'four-in-a-row') {
    classes.push((row+col)%2 ? 'dark-square' : 'light-square')
    if (row === rows-1 || col === 0) {
      const coords = document.createElement('span')
      coords.className = 'coordinate'
      coords.textContent = (col === 0 ? rows-row : '')+(row === rows-1 ? 'abcdefgh'[col] : '')
      coords.setAttribute('aria-hidden','true')
      button.append(coords)
    }
  }
  if (from && !isComputer()) classes.push('origin')
  if (to && !isComputer()) classes.push('destination')
  if (selected === id) classes.push('selected')
  if (last.includes(id)) classes.push('last')
  if (state.winning?.includes(id)) classes.push('winning')
  if (active === 'chess' && piece?.type === 'k' && state.engine.isCheck() &&
      (piece.color === 'w' ? 1 : -1) === state.turn) classes.push('in-check')
  button.className = classes.join(' ')
  if (piece) {
    const token = document.createElement('span')
    const color = active === 'chess' ? (piece.color === 'w' ? 1 : -1) : Math.sign(piece)
    token.className = 'token '+(color === 1 ? 'sea' : 'sun')
    token.setAttribute('aria-hidden','true')
    if (active === 'chess') token.textContent = blackChess[piece.type]+'\uFE0E'
    else if (Math.abs(piece) === 2) token.textContent = '✦'
    button.append(token)
  }
}

function render(focus) {
  clearTimeout(timer)
  const {state} = session()
  legal = games[active].moves(state)
  const computer = isComputer()
  const result = state.result
  const cols = active === 'four-in-a-row' ? 7 : 8
  const rows = active === 'four-in-a-row' ? 6 : 8
  const pieces = active === 'chess' ? state.engine.board().flat() : state.board
  board.replaceChildren()
  board.className = active
  board.setAttribute('aria-label',get('game-name').textContent+' board')
  if (active === 'chinese-checkers') addStar()

  const firstMove = legal[0]?.from ?? legal[0]?.to ?? 0
  const focused = focus ?? selected ?? firstMove
  pieces.forEach((piece,id) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.cell = id
    button.tabIndex = focused === id ? 0 : -1
    button.setAttribute('aria-label',cellLabel(id,piece,state,cols,rows))
    if (computer || result) button.setAttribute('aria-disabled','true')
    decorateCell(button,id,piece,state,cols,rows)
    board.append(button)
  })
  get('first-side').lastElementChild.textContent = session().opponent === 'computer' ? 'You · Sea Glass' : 'Sea Glass'
  get('second-side').lastElementChild.textContent = session().opponent === 'computer' ? 'Computer · Sunset' : 'Sunset'
  get('first-side').classList.toggle('turn',!result && state.turn === 1)
  get('second-side').classList.toggle('turn',!result && state.turn === -1)

  let status = name(state.turn)+(name(state.turn)==='You' ? ' move.' : ' to move.')
  if (result) status = (result.winner === 0 ? 'Draw.' : name(result.winner)+(name(result.winner)==='You' ? ' win.' : ' wins.'))+' '+result.reason
  else if (active === 'chess' && state.engine.isCheck()) status += ' Check.'
  else if (state.forced != null) status += ' Continue the jump.'
  else if (state.pass != null) status = name(state.pass)+' passes. '+status
  else if (!legal.length && active === 'chinese-checkers') status = name(state.turn)+' passes.'
  get('status').textContent = status

  let counts = ''
  if (active === 'chinese-checkers') {
    const finished = side => pieces.filter((piece,id) => piece === side && holes[id].camp === -side).length
    counts = 'Home · '+finished(1)+'/10 : '+finished(-1)+'/10'
  } else if (active === 'checkers' || active === 'reversi') {
    const remaining = side => pieces.filter(piece => Math.sign(piece) === side).length
    counts = (active === 'reversi' ? 'Discs' : 'Pieces left')+' · '+remaining(1)+' : '+remaining(-1)
  } else if (state.notation) counts = 'Last move · '+state.notation
  get('score').textContent = counts
  if (focus != null) board.querySelector('[data-cell="'+focus+'"]')?.focus({preventScroll:true})
  queueTurn()
}

board.addEventListener('click', event => {
  const button = event.target.closest('[data-cell]')
  if (!button || isComputer() || session().state.result || promotion.open) return
  const id = Number(button.dataset.cell)
  const cellMoves = legal.filter(move => active === 'four-in-a-row' ? move.col === id % 7 :
    move.to === id && move.from === (selected ?? undefined))
  if (cellMoves.length > 1 && cellMoves.every(move => move.promotion)) {
    awaitingPromotion = cellMoves
    promotion.returnValue = ''
    promotion.showModal()
    return
  }
  if (cellMoves.length) return apply(cellMoves[0])
  if (session().state.forced !== null && session().state.forced !== undefined) return
  selected = legal.some(move => move.from === id) && selected !== id ? id : null
  render(id)
})
board.addEventListener('keydown',event => {
  const vector = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key]
  const current = event.target.closest('[data-cell]')
  if (!vector || !current) return
  event.preventDefault()
  const [dx,dy] = vector, origin = current.getBoundingClientRect()
  let best, distance = Infinity
  for (const cell of board.querySelectorAll('[data-cell]')) {
    const rect = cell.getBoundingClientRect(), x = rect.x-origin.x, y = rect.y-origin.y
    const forward = x*dx+y*dy
    const lateral = Math.abs(y*dx-x*dy)
    if (forward < 2 || lateral > forward*1.7) continue
    const cost = forward+2*lateral
    if (cost < distance) {best = cell; distance = cost}
  }
  if (best) {
    board.querySelector('[tabindex="0"]').tabIndex = -1
    best.tabIndex = 0
    best.focus()
  }
})
promotion.addEventListener('close', () => {
  const pending = awaitingPromotion
  awaitingPromotion = null
  const move = pending?.find(action => action.promotion === promotion.returnValue)
  if (move) apply(move)
  else if (pending) board.querySelector('[data-cell="'+pending[0].to+'"]')?.focus()
})
get('restart').addEventListener('click',() => reset(session().opponent))
get('opponent').addEventListener('change',event => reset(event.target.value))
picker.addEventListener('click',event => {
  const link = event.target.closest('a')
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (location.hash !== link.hash) history.pushState(null,'',link.hash)
  selectGame()
})
window.addEventListener('hashchange',selectGame)
selectGame()
