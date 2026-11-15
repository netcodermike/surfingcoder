import { questions, subjects } from './deck.mjs';

export const limit = 20;

export function nextTurn(history) {
  let candidates = subjects;
  const asked = new Set();
  for (const { turn, answer } of history) {
    if (turn.kind === 'guess') {
      if (answer === 'yes') return { kind: 'won', subject: turn.subject };
      if (answer === 'no') candidates = candidates.filter(subject => subject.id !== turn.subject.id);
      continue;
    }
    asked.add(turn.key);
    if (answer !== 'skip') {
      candidates = candidates.filter(subject => subject.traits.has(turn.key) === (answer === 'yes'));
    }
  }

  if (!candidates.length || history.length >= limit) {
    return { kind: 'lost', matches: candidates.length };
  }

  let bestKey;
  let bestSplit = 0;
  for (const key of Object.keys(questions)) {
    if (asked.has(key)) continue;
    const yes = candidates.filter(subject => subject.traits.has(key)).length;
    const smallerSide = Math.min(yes, candidates.length - yes);
    if (smallerSide > bestSplit) {
      bestKey = key;
      bestSplit = smallerSide;
    }
  }

  // Keep the last question available for a guess, even if some clues were skipped.
  if (!bestKey || history.length === limit - 1) {
    const [subject] = candidates;
    return { kind: 'guess', subject, prompt: `Is it ${subject.name}?` };
  }

  return { kind: 'clue', key: bestKey, prompt: questions[bestKey] };
}
