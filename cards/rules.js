export const SUITS = [
  { id: 'clubs', mark: '♣', name: 'Clubs' },
  { id: 'diamonds', mark: '♦', name: 'Diamonds' },
  { id: 'spades', mark: '♠', name: 'Spades' },
  { id: 'hearts', mark: '♥', name: 'Hearts' },
]
export const ranks = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const suitInfo = suit => SUITS.find(item => item.id === suit)
export const describe = card => card.rank === 0 ? 'the surfer Joker' : `${ranks[card.rank]} of ${suitInfo(card.suit).name.toLowerCase()}`
export const isWild = card => card.rank === 8 || card.rank === 0

function shuffled(cards, random) {
  const result = [...cards]
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    const card = result[index]
    result[index] = result[other]
    result[other] = card
  }
  return result
}

function deck(random) {
  return shuffled(SUITS.flatMap(({ id }) => Array.from({length:13}, (_, index) => ({suit:id, rank:index+1}))), random)
}

export function newGolf(random = Math.random) {
  const cards = deck(random)
  const columns = Array.from({length:7}, () => cards.splice(0,5))
  return { columns, waste: cards.pop(), stock: cards, moved: 0, status: 'playing' }
}

export function canGolf(card, waste) {
  return Boolean(card && Math.abs(card.rank - waste.rank) === 1)
}

function checkGolf(game) {
  if (game.moved === 35) game.status = 'won'
  else if (!game.stock.length && !game.columns.some(column => canGolf(column.at(-1),game.waste))) game.status = 'lost'
}

export function moveGolf(game, index) {
  const column = game.columns[index]
  if (game.status !== 'playing' || !canGolf(column?.at(-1),game.waste)) return false
  game.waste = column.pop()
  game.moved++
  checkGolf(game)
  return true
}

export function drawGolf(game) {
  if (game.status !== 'playing' || !game.stock.length) return false
  game.waste = game.stock.pop()
  checkGolf(game)
  return true
}

export function newEights(random = Math.random) {
  const cards = shuffled([...deck(random), {rank:0,suit:'joker'}, {rank:0,suit:'joker'}],random)
  const player = cards.splice(0,7), computer = cards.splice(0,7)
  const opening = cards.findIndex(card => !isWild(card))
  const discard = cards.splice(opening,1)
  return { player, computer, stock:cards, discard, suit:discard[0].suit,
    drawn:false, passes:0, status:'playing', message:'Match the suit or rank, or play a wild card.' }
}

export function canEights(game, card) {
  const top = game.discard.at(-1)
  return Boolean(card && (isWild(card) || card.suit === game.suit || (!isWild(top) && card.rank === top.rank)))
}

function putEights(game, hand, index, suit) {
  const [card] = hand.splice(index,1)
  game.discard.push(card)
  game.suit = isWild(card) ? suit : card.suit
  game.passes = 0
  return card
}

function takeCard(game, random) {
  if (!game.stock.length && game.discard.length > 1) {
    const top = game.discard.pop()
    game.stock = shuffled(game.discard, random)
    game.discard = [top]
  }
  return game.stock.pop()
}

function finishPass(game) {
  if (++game.passes < 2) return
  game.status = game.player.length === game.computer.length ? 'tie'
    : game.player.length < game.computer.length ? 'won' : 'lost'
  game.message = 'Neither hand can play. The hand with fewer cards wins.'
}

function computerTurn(game, random) {
  game.drawn = false
  const hand = game.computer
  const choose = () => hand.findIndex(card => !isWild(card) && canEights(game,card))
  let index = choose()
  if (index < 0) index = hand.findIndex(isWild)
  if (index < 0) {
    const card = takeCard(game,random)
    if (card) {
      hand.push(card)
      if (canEights(game,card)) index = hand.length-1
      else {
        game.passes = 0
        game.message = 'Computer drew and passed. Your turn.'
        return
      }
    } else {
      game.message = 'Computer passed. Your turn.'
      finishPass(game)
      return
    }
  }
  const suit = SUITS.reduce((best,item) =>
    hand.filter(card => card.suit === item.id && !isWild(card)).length >
    hand.filter(card => card.suit === best && !isWild(card)).length ? item.id : best, game.suit)
  const card = putEights(game,hand,index,suit)
  if (!hand.length) game.status = 'lost'
  game.message = `Computer played ${describe(card)}${isWild(card) ? ` and chose ${suitInfo(suit).name.toLowerCase()}` : ''}.`
}

export function moveEights(game, index, suit, random = Math.random) {
  const card = game.player[index]
  if (game.status !== 'playing' || !canEights(game,card) || (isWild(card) && !suitInfo(suit))) return false
  putEights(game,game.player,index,suit)
  if (!game.player.length) {
    game.status = 'won'
    game.message = 'You played your last card.'
  } else computerTurn(game,random)
  return true
}

export function drawEights(game, random = Math.random) {
  if (game.status !== 'playing' || game.drawn || game.player.some(card => canEights(game,card))) return false
  const card = takeCard(game,random)
  if (!card) {
    game.message = 'You passed.'
    finishPass(game)
    if (game.status === 'playing') computerTurn(game,random)
    return true
  }
  game.player.push(card)
  game.passes = 0
  game.drawn = true
  if (canEights(game,card)) game.message = `You drew ${describe(card)}. Play it.`
  else computerTurn(game,random)
  return true
}
