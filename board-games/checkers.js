const diagonals = [[-1,-1],[-1,1],[1,-1],[1,1]]
const index = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8 ? row * 8 + col : -1
const sideOf = piece => Math.sign(piece)

export function createCheckers() {
  const board = Array.from({length:64}, (_, id) => {
    const row = Math.floor(id / 8), col = id % 8
    return (row + col) % 2 ? row < 3 ? -1 : row > 4 ? 1 : 0 : 0
  })
  return {board, turn:1, forced:null, quiet:0, seen:new Map([['1|'+board.join(','),1]]), result:null}
}

function steps(board, from, capture) {
  const row = Math.floor(from / 8), col = from % 8
  const piece = board[from], side = sideOf(piece), moves = []
  for (const [dr, dc] of diagonals) {
    if (Math.abs(piece) === 1 && dr !== -side) continue
    const adjacent = index(row + dr, col + dc)
    if (!capture && board[adjacent] === 0) moves.push({from,to:adjacent})
    if (capture && sideOf(board[adjacent]) === -side) {
      const to = index(row + dr * 2, col + dc * 2)
      if (board[to] === 0) moves.push({from,to,capture:adjacent})
    }
  }
  return moves
}

export function checkersMoves(state) {
  if (state.result) return []
  if (state.forced !== null) return steps(state.board,state.forced,true)
  const pieces = state.board.flatMap((piece,id) => sideOf(piece) === state.turn ? [id] : [])
  const captures = pieces.flatMap(id => steps(state.board,id,true))
  return captures.length ? captures : pieces.flatMap(id => steps(state.board,id,false))
}

export function playCheckers(state, move) {
  const {from,to,capture} = move
  const board = state.board.slice(), piece = board[from]
  const promotes = Math.abs(piece) === 1 && Math.floor(to / 8) === (state.turn === 1 ? 0 : 7)
  board[from] = 0
  board[to] = promotes ? piece * 2 : piece
  if (capture !== undefined) {
    board[capture] = 0
    if (!promotes && steps(board,to,true).length) {
      return {...state, board, forced:to, quiet:0}
    }
  }
  const next = {...state, board, turn:-state.turn, forced:null,
    quiet:capture !== undefined || Math.abs(piece) === 1 ? 0 : state.quiet + 1}
  const key = next.turn + '|' + board.join(',')
  next.seen = new Map(state.seen)
  const occurrences = (next.seen.get(key) ?? 0) + 1
  next.seen.set(key,occurrences)
  if (!checkersMoves(next).length) next.result = {winner:state.turn, reason:'The other side has no legal move.'}
  else if (occurrences >= 3 || next.quiet >= 80) next.result = {winner:0, reason:'The position repeated or neither side made progress.'}
  return next
}

function evaluate(state) {
  return state.board.reduce((value,piece,id) => {
    const row = Math.floor(id / 8), side = sideOf(piece)
    const advance = side === 1 ? 7 - row : row
    return value + side * (Math.abs(piece) === 2 ? 2.3 : 1 + advance * .055)
  },0)
}

export function chooseCheckers(state) {
  function search(position,depth) {
    if (position.result) return position.result.winner * (100 + depth)
    if (depth === 0 && position.forced === null) return evaluate(position)
    const values = checkersMoves(position).map(move => {
      const next = playCheckers(position,move)
      return search(next,next.turn === position.turn ? depth : Math.max(0,depth - 1))
    })
    return position.turn === 1 ? Math.max(...values) : Math.min(...values)
  }
  return checkersMoves(state).map(move => ({move,value:search(playCheckers(state,move),2) * state.turn}))
    .sort((a,b) => b.value-a.value)[0]?.move
}
