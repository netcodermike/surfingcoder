export const initial=[[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]];
export function stepTime(step,bpm,swing){if(bpm<30||bpm>240||swing<0||swing>.45)throw Error('Tempo 30–240, swing 0–0.45');return step*15/bpm+(step%2?swing*15/bpm:0)}
export function validate(pattern){if(!Array.isArray(pattern)||pattern.length!==3||pattern.some(r=>r.length!==16||r.some(v=>v!==0&&v!==1)))throw Error('Expected three rows of sixteen binary steps');return pattern}
