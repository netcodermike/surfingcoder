import {Chess} from './vendor/chess.js'

const files = 'abcdefgh'
const square = id => files[id % 8] + (8 - Math.floor(id / 8))
const squareId = name => (8 - Number(name[1])) * 8 + files.indexOf(name[0])
export const createChess = () => ({engine:new Chess(),turn:1,result:null})
export function chessMoves(state) {
  return state.result ? [] : state.engine.moves({verbose:true}).map(move =>
    ({from:squareId(move.from),to:squareId(move.to),promotion:move.promotion,move}))
}
export function playChess(state,action) {
  const {engine} = state
  const move = engine.move({from:square(action.from),to:square(action.to),promotion:action.promotion})
  let result = null
  if (engine.isCheckmate()) result = {winner:state.turn,reason:'Checkmate.'}
  else if (engine.isStalemate()) result = {winner:0,reason:'Stalemate.'}
  else if (engine.isInsufficientMaterial()) result = {winner:0,reason:'Insufficient material.'}
  else if (engine.isThreefoldRepetition()) result = {winner:0,reason:'Threefold repetition.'}
  else if (engine.isDrawByFiftyMoves()) result = {winner:0,reason:'Fifty moves without a pawn move or capture.'}
  return {engine,turn:-state.turn,result,notation:move.san}
}
const values = {p:100,n:315,b:330,r:500,q:900,k:0}
function scorePosition(engine,side) {
  return engine.board().flat().reduce((score,piece,id) => {
    if (!piece) return score
    const row = Math.floor(id/8), col = id%8, white = piece.color === 'w'
    const central = 7 - Math.abs(3.5-row) - Math.abs(3.5-col)
    const activity = piece.type === 'p' ? (white ? 6-row : row-1)*4+central*3
      : piece.type === 'k' ? 0 : central*5
    return score + (white ? side : -side)*(values[piece.type]+activity)
  },0)
}
function push(engine,move) {
  engine.move({from:move.from,to:move.to,promotion:move.promotion})
}
export function chooseChess(state) {
  const {engine,turn} = state
  let best, bestScore = -Infinity
  for (const action of chessMoves(state)) {
    push(engine,action.move)
    const replies = engine.moves({verbose:true})
    let score = replies.length ? Infinity : engine.isCheck() ? 100000 : 0
    if (engine.isDraw()) score = 0
    else for (const reply of replies) {
      push(engine,reply)
      score = Math.min(score,scorePosition(engine,turn))
      engine.undo()
      if (score < bestScore) break
    }
    engine.undo()
    if (score > bestScore) {
      best = action
      bestScore = score
    }
  }
  return best
}
