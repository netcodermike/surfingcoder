const vectors = [-1,0,1].flatMap(dr => [-1,0,1].filter(dc => dr || dc).map(dc => [dr,dc]))
export function createReversi() {
  const board = Array(64).fill(0)
  board[28] = board[35] = 1
  board[27] = board[36] = -1
  return {board,turn:1,pass:null,result:null}
}

export function reversiMoves(state) {
  if (state.result) return []
  const {board,turn} = state
  return board.flatMap((piece,id) => {
    if (piece) return []
    const row = Math.floor(id / 8), col = id % 8
    const flips = []
    for (const [dr,dc] of vectors) {
      const run = []
      for (let r = row+dr, c = col+dc; r >= 0 && r < 8 && c >= 0 && c < 8; r += dr, c += dc) {
        const target = r*8+c
        if (board[target] === -turn) run.push(target)
        else {
          if (board[target] === turn) flips.push(...run)
          break
        }
      }
    }
    return flips.length ? [{to:id,flips}] : []
  })
}
export function playReversi(state,{to,flips}) {
  const board = state.board.slice()
  for (const id of [to,...flips]) board[id] = state.turn
  const next = {board,turn:-state.turn,pass:null,result:null}
  if (reversiMoves(next).length) return next
  next.turn = state.turn
  if (reversiMoves(next).length) next.pass = -state.turn
  else next.result = {winner:Math.sign(board.reduce((a,b) => a+b,0)),reason:'Neither side has a legal move.'}
  return next
}
const weights = [
   35,-12, 6, 3, 3, 6,-12, 35,
  -12,-20,-2,-2,-2,-2,-20,-12,
    6, -2, 3, 1, 1, 3, -2,  6,
    3, -2, 1, 1, 1, 1, -2,  3,
    3, -2, 1, 1, 1, 1, -2,  3,
    6, -2, 3, 1, 1, 3, -2,  6,
  -12,-20,-2,-2,-2,-2,-20,-12,
   35,-12, 6, 3, 3, 6,-12, 35,
]
export function chooseReversi(state) {
  function search(position,depth) {
    if (position.result) return position.result.winner * 1000
    const moves = reversiMoves(position)
    if (depth === 0) return position.board.reduce((a,b,i) => a + b*weights[i],0) + position.turn*moves.length
    const scores = moves.map(move => search(playReversi(position,move),depth-1))
    return position.turn === 1 ? Math.max(...scores) : Math.min(...scores)
  }
  return reversiMoves(state).map(move => ({move,score:state.turn*search(playReversi(state,move),2)}))
    .sort((a,b) => b.score-a.score)[0]?.move
}
