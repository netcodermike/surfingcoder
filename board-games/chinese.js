const counts = [1,2,3,4,13,12,11,10,9,10,11,12,13,4,3,2,1]
const directions = [[2,0],[1,1],[-1,1],[-2,0],[-1,-1],[1,-1]]
export const holes = counts.flatMap((count,row) =>
  Array.from({length:count}, (_, col) => ({x:13-count+2*col,y:row, camp:row < 4 ? -1 : row > 12 ? 1 : 0})))
const coordinates = new Map(holes.map(({x,y},id) => [x + ',' + y,id]))
for (const hole of holes) {
  hole.neighbors = directions.map(([dx,dy]) => ({
    adjacent:coordinates.get((hole.x+dx) + ',' + (hole.y+dy)),
    landing:coordinates.get((hole.x+2*dx) + ',' + (hole.y+2*dy)),
  }))
}
export function createChinese() {
  return {board:holes.map(hole => hole.camp), turn:1, passes:0, result:null}
}
export function chineseMoves(state,from) {
  if (state.result) return []
  const {board,turn} = state
  const origins = from === undefined ? board.flatMap((piece,id) => piece === turn ? [id] : []) : [from]
  const moves = []
  for (const origin of origins) {
    if (board[origin] !== turn) continue
    const allowed = (a,b) => holes[a].camp !== -turn || holes[b].camp === -turn
    for (const {adjacent} of holes[origin].neighbors) {
      if (board[adjacent] === 0 && allowed(origin,adjacent)) moves.push({from:origin,to:adjacent,path:[origin,adjacent]})
    }
    const paths = new Map([[origin,[origin]]])
    const queue = [origin]
    for (const current of queue) {
      for (const {adjacent,landing} of holes[current].neighbors) {
        if (adjacent === origin || !board[adjacent] || board[landing] !== 0 ||
            paths.has(landing) || !allowed(current,landing)) continue
        const path = [...paths.get(current),landing]
        paths.set(landing,path)
        queue.push(landing)
        moves.push({from:origin,to:landing,path})
      }
    }
  }
  return moves
}

export function playChinese(state,move) {
  const {turn} = state
  if (!move) {
    const passes = state.passes + 1
    return {...state,turn:-turn,passes,result:passes >= 2 ? {winner:0,reason:'Neither side can move.'} : null}
  }
  const board = state.board.slice()
  board[move.from] = 0
  board[move.to] = turn
  const win = holes.every((hole,id) => hole.camp !== -turn || board[id] === turn)
  return {board,turn:-turn,passes:0,result:win ? {winner:turn,reason:'All ten marbles reached their destination.'} : null}
}

export function chooseChinese(state) {
  const targetX = 12, targetY = state.turn === 1 ? 1 : 15
  function cost(id) {
    const {x,y,camp} = holes[id]
    const goalDepth = state.turn === 1 ? y : 16-y
    return Math.hypot((x-targetX)*.58,y-targetY) + (camp === -state.turn ? .5*goalDepth-4 : 0)
      + (camp === state.turn ? 1 : 0)
  }
  return chineseMoves(state).map(move => ({
    move,value:cost(move.from)-cost(move.to)+(move.path.length-2)*.025+Math.random()*.09
  })).sort((a,b) => b.value-a.value)[0]?.move
}
