const rows = 6, cols = 7
const axes = [[0,1],[1,0],[1,1],[1,-1]]
const columnOrder = [3,2,4,1,5,0,6]
export const createFour = () => ({board:Array(rows*cols).fill(0),turn:1,result:null,winning:[]})

export function fourMoves(state) {
  if (state.result) return []
  const moves = []
  for (const col of columnOrder) {
    for (let row=rows-1; row >= 0; row--) {
      const to = row*cols+col
      if (state.board[to]) continue
      moves.push({to,col})
      break
    }
  }
  return moves
}
function chain(board,row,col,dr,dc,side) {
  const cells = []
  for (let r = row+dr,c = col+dc; r >= 0 && r < rows && c >= 0 && c < cols; r += dr,c += dc) {
    const id = r*cols+c
    if (board[id] !== side) break
    cells.push(id)
  }
  return cells
}
export function playFour(state,{to,col}) {
  const board = state.board.slice(), side = state.turn
  const row = Math.floor(to / cols)
  board[to] = side
  const winning = axes.map(([dr,dc]) => [to,...chain(board,row,col,dr,dc,side),...chain(board,row,col,-dr,-dc,side)])
    .filter(line => line.length >= 4).flat()
  const result = winning.length ? {winner:side,reason:'Four in a row.'}
    : board.every(Boolean) ? {winner:0,reason:'The board is full.'} : null
  return {board,turn:-side,result,winning}
}
export function chooseFour(state) {
  function search(position,depth,alpha,beta) {
    if (position.result) return position.result.winner * (100 + depth)
    if (depth === 0) return position.board.reduce((a,b,i) => a+b*(4-Math.abs(i%cols-3)),0)
    const maximizing = position.turn === 1
    let value = maximizing ? -Infinity : Infinity
    for (const move of fourMoves(position)) {
      const score = search(playFour(position,move),depth-1,alpha,beta)
      value = maximizing ? Math.max(value,score) : Math.min(value,score)
      if (maximizing) alpha = Math.max(alpha,value)
      else beta = Math.min(beta,value)
      if (alpha >= beta) break
    }
    return value
  }
  return fourMoves(state).map(move => ({move,score:state.turn*search(playFour(state,move),3,-Infinity,Infinity)}))
    .sort((a,b) => b.score-a.score)[0]?.move
}
