import { SUITS, ranks, suitInfo, describe, newGolf, canGolf, moveGolf, drawGolf,
  newEights, canEights, moveEights, drawEights } from './rules.js'
import { drawJoker } from './joker.js'

const get = id => document.getElementById(id)
const board = get('board')
const games = {
  golf: {
    title:'Golf Solitaire', create:newGolf,
    help:'Clear all seven columns. Play any exposed card one rank higher or lower than the waste. Ace and King do not connect. Draw from the stock when you need a new waste card.',
  },
  eights: {
    title:'Crazy Eights', create:newEights,
    help:'Empty your hand before the computer. Match the top rank or active suit. Eights and the two surfer Jokers are wild. Choose a suit before playing one. If you have no move, draw once. The computer takes its turn if your new card cannot play.',
  },
}
const hands = { golf:newGolf(), eights:newEights() }
let mode = 'golf'
let chosen = 'clubs'

function element(tag, className, text) {
  const item = document.createElement(tag)
  if (className) item.className = className
  if (text) item.textContent = text
  return item
}

function cardView(card, action, playable = false, label) {
  const item = element(action ? 'button' : 'div', 'card')
  if (action) {
    item.type = 'button'
    item.addEventListener('click', action)
  } else item.setAttribute('role','img')
  item.setAttribute('aria-label', label || (card ? describe(card) : 'Face-down card'))
  item.classList.toggle('playable',playable)
  if (!card) {
    item.classList.add('back')
    item.append(element('span','suit','∿'))
  } else if (card.rank === 0) {
    item.classList.add('joker')
    item.append(element('span','corner','JOKER'), drawJoker())
  } else {
    item.classList.toggle('red',card.suit === 'hearts' || card.suit === 'diamonds')
    item.append(element('span','corner',ranks[card.rank]),element('span','suit',suitInfo(card.suit).mark))
  }
  return item
}

function pile(label, card) {
  const item = element('div','pile')
  item.append(card,element('span','',label))
  return item
}

function drawButton(label, allowed, callback) {
  const button = cardView(null,callback,false,label)
  button.disabled = !allowed
  return button
}

function change(action) {
  if (!action()) return
  render()
  ;(board.querySelector('button.playable, button:not(:disabled)') || get('deal')).focus({preventScroll:true})
}

function golfBoard(game) {
  const piles = element('div','piles')
  piles.append(pile(`Draw · ${game.stock.length} left`,drawButton('Draw from the stock',
    game.status === 'playing' && game.stock.length,() => change(() => drawGolf(game)))),pile('Waste',cardView(game.waste)))
  const columns = element('div','columns')
  game.columns.forEach((cards,index) => {
    const column = element('div','column')
    if (!cards.length) column.append(element('div','empty-card','✓'))
    cards.forEach((card, position) => {
      const playable = game.status === 'playing' && position === cards.length-1 && canGolf(card,game.waste)
      column.append(cardView(card,playable ? () => change(() => moveGolf(game,index)) : null,playable))
    })
    columns.append(column)
  })
  board.append(piles,columns)
  get('score').textContent = `${game.moved} / 35 cleared`
  return game.status === 'won' ? 'You cleared the table.' : game.status === 'lost'
    ? 'No moves left. Deal again to try a new table.' : 'Play an outlined card or draw from the stock.'
}

function eightsBoard(game) {
  const piles = element('div','piles')
  const draw = drawButton('Draw a card or pass if the stock is empty',
    game.status === 'playing' && !game.drawn && !game.player.some(card => canEights(game,card)),
    () => change(() => drawEights(game)))
  piles.append(pile(`Draw · ${game.stock.length} left`,draw),
    pile(`Suit · ${suitInfo(game.suit).name}`,cardView(game.discard.at(-1))))
  const label = element('label','suit-choice','Suit for your wild card')
  const select = document.createElement('select')
  SUITS.forEach(item => select.add(new Option(`${item.mark} ${item.name}`,item.id)))
  select.value = chosen
  select.disabled = game.status !== 'playing'
  select.addEventListener('change', () => { chosen = select.value })
  label.append(select)
  const sample = element('div','wild-example')
  sample.append(cardView({rank:0,suit:'joker'}),element('span','','Surfer Joker'))
  const wildControls = element('div','pile')
  wildControls.append(label,sample)
  piles.append(wildControls)
  const hand = element('div','hand')
  game.player.forEach((card,index) => {
    const playable = game.status === 'playing' && canEights(game,card)
    hand.append(cardView(card,playable ? () => change(() => moveEights(game,index,chosen)) : null,playable))
  })
  board.append(piles,element('h3','hand-label','Your hand'),hand)
  get('score').textContent = `You ${game.player.length} · Computer ${game.computer.length}`
  if (game.status === 'won') return `You win. ${game.message}`
  if (game.status === 'lost') return `Computer wins. ${game.message}`
  if (game.status === 'tie') return `Draw. ${game.message}`
  return game.message
}

function render() {
  board.replaceChildren()
  for (const key of Object.keys(games)) get(key).setAttribute('aria-pressed',String(key === mode))
  get('mode-title').textContent = games[mode].title
  get('rules').textContent = games[mode].help
  get('status').textContent = mode === 'golf' ? golfBoard(hands.golf) : eightsBoard(hands.eights)
}

for (const key of Object.keys(games)) get(key).addEventListener('click', () => { mode = key; render() })
get('deal').addEventListener('click', () => { hands[mode] = games[mode].create(); render() })
render()
