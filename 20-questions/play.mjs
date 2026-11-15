import { groups, subjects } from './deck.mjs';
import { limit, nextTurn } from './game.mjs';

const $ = id => document.getElementById(id);
const answerButtons = [...document.querySelectorAll('[data-answer]')];
const labels = { yes: 'Yes', no: 'No', skip: 'Not sure' };
const history = [];
let turn;
let playing = false;

for (const [group, label] of Object.entries(groups)) {
  const heading = document.createElement('h3');
  heading.textContent = label;
  const list = document.createElement('p');
  list.textContent = subjects.filter(subject => subject.group === group)
    .map(subject => subject.name.replace(/^(a|an) /, '')).join(' · ');
  $('catalog-list').append(heading, list);
}

function render(focus = false) {
  turn = playing ? nextTurn(history) : null;
  const active = turn?.kind === 'clue' || turn?.kind === 'guess';
  $('used').textContent = history.length;
  $('progress').value = history.length;
  $('turn-label').textContent = !playing ? 'Ready to play'
    : active ? (turn.kind === 'guess' ? 'Making a guess' : `Question ${history.length + 1} of ${limit}`)
      : 'Round complete';
  $('start').hidden = playing;
  $('actions').hidden = !playing;
  $('undo').disabled = !history.length;
  for (const button of answerButtons) {
    button.hidden = !active || (button.dataset.answer === 'skip' && turn.kind === 'guess');
  }

  if (!turn) {
    $('prompt').textContent = 'Pick something familiar.';
    $('detail').textContent = 'Think of an animal, everyday object, food, place, or something you’d find by the ocean. Keep it to yourself.';
  } else if (active) {
    $('prompt').textContent = turn.prompt;
    $('detail').textContent = turn.kind === 'guess' ? 'Did the computer get it right?' : 'Answer yes, no, or skip if you’re unsure.';
  } else if (turn.kind === 'won') {
    $('prompt').textContent = `I guessed it: ${turn.subject.name}!`;
    $('detail').textContent = `It took ${history.length} ${history.length === 1 ? 'question' : 'questions'}.`;
  } else {
    $('prompt').textContent = 'You stumped me!';
    $('detail').textContent = turn.matches
      ? 'I ran out of questions. Try a new round or undo your last answer.'
      : 'No answers in my catalog match those clues. Try a new round or undo your last answer.';
  }

  $('empty-log').hidden = history.length > 0;
  $('log').replaceChildren(...history.slice().reverse().map(entry => {
    const row = document.createElement('li');
    const response = document.createElement('strong');
    response.textContent = labels[entry.answer];
    row.append(`${entry.turn.prompt} `, response);
    return row;
  }));
  if (focus) $('prompt').focus({ preventScroll: true });
}

$('start').addEventListener('click', () => {
  playing = true;
  $('catalog').open = false;
  render(true);
});
$('restart').addEventListener('click', () => {
  playing = false;
  history.length = 0;
  render();
  $('start').focus();
});
$('undo').addEventListener('click', () => {
  history.pop();
  render(true);
});
for (const button of answerButtons) {
  button.addEventListener('click', () => {
    if (button.hidden) return;
    history.push({ turn, answer: button.dataset.answer });
    render(true);
  });
}

render();
