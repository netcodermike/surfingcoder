import { get, make, setStatus } from '../../assets/game-editions.mjs';

const challenges = [
  ['COLD', 'WARM', 'CORD CARD WARD WORD WORM WORE CORE CARE WARE BOLD BALD BARD BARM FARM HARD HARM WARM COLD'],
  ['HEAD', 'TAIL', 'HEAD HEAL TEAL TELL TALL TAIL MEAL REAL DEAL DEAR YEAR HEAR TEAR PEAR HAIL BAIL HALL MAIL'],
  ['LEAD', 'GOLD', 'LEAD LOAD GOAD GOLD BOLD COLD SOLD FOLD MOLD HOLD TOLD LOAN LOAF LEAF BEAD BEAR GOLF'],
];
let list, words, goal;

function adjacent(a, b) {
  return [...a].filter((letter, i) => letter !== b[i]).length === 1;
}

function render() {
  get('ladder').replaceChildren(...list.map(word => make('span', word)));
  const won = list.at(-1) === goal;
  get('submit-word').querySelectorAll('input,button').forEach(control => control.disabled = won);
  get('undo').disabled = list.length === 1;
}

function reset() {
  const [start, end, bank] = challenges[Number(get('challenge').value)];
  list = [start];
  goal = end;
  words = bank.split(' ').sort();
  get('summary').textContent = start + ' → ' + goal;
  get('dictionary').textContent = words.join(' · ');
  get('word').value = '';
  setStatus('Enter a word one letter away from ' + start + '.');
  render();
}

challenges.forEach(([start, end], i) => get('challenge').append(make('option', start + ' → ' + end, { value: i })));
get('challenge').onchange = reset;
get('reset').onclick = reset;
get('undo').onclick = () => { list.pop(); setStatus('Back to ' + list.at(-1) + '.'); render(); };
get('submit-word').onsubmit = event => {
  event.preventDefault();
  const word = get('word').value.trim().toUpperCase();
  if (!words.includes(word)) { setStatus('Choose a four-letter word from the challenge list.'); return; }
  if (!adjacent(list.at(-1), word)) { setStatus('Change exactly one letter.'); return; }
  list.push(word);
  get('word').value = '';
  setStatus(word === goal ? 'Goal reached in ' + (list.length - 1) + ' steps!' : 'Keep going from ' + word + '.');
  render();
};
get('hint').onclick = () => {
  const start = list.at(-1);
  if (start === goal) { setStatus('You already reached the goal.'); return; }
  const queue = [[start, null]];
  const seen = new Set([start]);
  for (const [word, first] of queue) {
    if (word === goal) { setStatus('Try ' + first + '.'); return; }
    for (const target of words) {
      if (!seen.has(target) && adjacent(word, target)) {
        seen.add(target);
        queue.push([target, first ?? target]);
      }
    }
  }
  setStatus('No route from this word. Try undoing your last move.');
};
reset();
