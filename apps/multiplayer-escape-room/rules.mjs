export const defaultRooms         = [
  {clue:'The clock stopped at 7:42. Enter its three digits.',code:'742',item:'brass key'},
  {clue:'A note reads: reverse the word drawer.',code:'reward',item:'star chart'},
  {clue:'The chart shows 3 rows of 4 stars. How many stars?',code:'12',item:'exit pass'}
];
export function solve(state       , answer        , rooms        )          {
  if (state.won) return false;
  state.moves++;
  if(answer.trim().toLowerCase() !== rooms[state.stage].code.toLowerCase()) return false;
  state.inventory.push(rooms[state.stage].item); state.stage++;
  state.won=state.stage===rooms.length; return true;
}
export function validateRooms(value         )                  {
  return Array.isArray(value) && value.length>0 && value.length<=20 && value.every(r=>r &&
    ['clue','code','item'].every(k=>typeof r[k]==='string' && r[k].trim().length>0 && r[k].length<=500));
}
