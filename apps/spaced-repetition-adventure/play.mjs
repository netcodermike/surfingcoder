import { get, make, setStatus } from '../../assets/game-editions.mjs';

const day = 86_400_000;
const storageKey = 'surfingcoder-recall-quest-v1';
const defaultDeck = [
  ['What is binary search’s time complexity?', 'O(log n)'],
  ['What does HTTP 404 mean?', 'Not Found'],
  ['Which data structure works first in, first out?', 'A queue'],
  ['What is six times seven?', '42'],
  ['What makes a function pure?', 'Its result depends only on its inputs, and it has no side effects.'],
];
const locations = ['Mosswood Trail', 'Ember Caves', 'Moonlit Keep', 'The Sky Library'];
const equipment = ['wooden wand', 'trail boots', 'silver compass', 'runic staff'];
let progress = { xp: 0, review: {}, imported: [] };
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && Number.isFinite(saved.xp) && saved.review && Array.isArray(saved.imported)) progress = saved;
} catch { /* Play can continue while storage is unavailable. */ }

let deck, pending, revealed, card;
const keyFor = card => JSON.stringify(card);
const persist = () => {
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); return true; } catch { return false; }
};
function begin() {
  deck = get('deck').value === 'custom' ? progress.imported : defaultDeck;
  pending = deck.filter(item => (progress.review[keyFor(item)]?.due ?? 0) <= Date.now());
  showNext();
}

function showNext() {
  card = pending.shift();
  revealed = false;
  get('front').textContent = card?.[0] ?? 'All caught up';
  get('back').textContent = card?.[1] ?? '';
  const level = progress.xp >= 100 ? 3 : progress.xp >= 50 ? 2 : progress.xp >= 20 ? 1 : 0;
  get('progress').textContent = progress.xp + ' XP · ' + locations[level] + ' · ' + equipment[level];
  setStatus(card ? (pending.length + 1) + ' cards due.' : 'Come back when more cards are due, or import another deck.');
  updateControls();
}

function updateControls() {
  get('back').hidden = !revealed;
  get('reveal').disabled = !card || revealed;
  get('remember').disabled = get('retry').disabled = !revealed;
}

function rate(remembered) {
  if (!revealed) return;
  const key = keyFor(card);
  const review = progress.review[key] ?? { interval: 0, ease: 2.5 };
  if (remembered) {
    review.interval = review.interval === 0 ? 1 : review.interval === 1 ? 3 : Math.round(review.interval * review.ease);
    progress.xp += 10;
  } else {
    review.interval = 0;
    review.ease = Math.max(1.3, review.ease - .2);
    pending.push(card);
  }
  review.due = Date.now() + day * review.interval;
  progress.review[key] = review;
  const saved = persist();
  showNext();
  if (!saved) setStatus('Browser storage is unavailable. Progress is kept for this session.');
}

get('deck').append(make('option', 'Computing and numbers', { value: 'default' }), make('option', 'Imported deck', { value: 'custom' }));
get('deck').onchange = begin;
get('import').onchange = async event => {
  const file = event.currentTarget.files[0];
  if (!file) return;
  if (file.size > 150_000) { setStatus('Choose a TSV file under 150 KB.'); return; }
  try {
    const lines = (await file.text()).split(/\r?\n/).filter(line => line.trim());
    const cards = lines.map(line => line.split('\t').map(field => field.trim()));
    if (!cards.length || cards.some(fields => fields.length !== 2 || fields.some(field => !field))) {
      setStatus('Each line needs a question and answer separated by one tab.');
      return;
    }
    progress.imported = [...new Map(cards.map(item => [keyFor(item), item])).values()];
    const saved = persist();
    get('deck').value = 'custom';
    begin();
    if (!saved) setStatus('Deck imported for this session. Browser storage is unavailable.');
  } catch { setStatus('This file could not be read.'); }
};
get('reveal').onclick = () => { revealed = true; updateControls(); };
get('remember').onclick = () => rate(true);
get('retry').onclick = () => rate(false);
begin();
