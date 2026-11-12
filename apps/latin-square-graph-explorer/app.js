
import {range, board, element, badge, colors, surface, download, table} from './ui.js';

export function square(n, r=1, seed=0) {
  return range(n).map(i=>range(n).map(j=>range(r).map(k=>{
    const row=(i+(k%2?0:seed))%n;
    const col=(j+(k%2?seed:0))%n;
    const multiplier=k%2?n-1:1;
    return k*n+(row+multiplier*col+k)%n;
  })));
}
export function validate(grid) {
  if (!Array.isArray(grid)||grid.length<1||grid.length>10) throw new RangeError('Use a square of order 1 to 10.');
  const n=grid.length, r=grid[0]?.[0]?.length;
  if (!Number.isInteger(r)||r<1||r>8||!grid.every(row=>Array.isArray(row)&&row.length===n&&row.every(cell=>Array.isArray(cell)&&cell.length===r&&cell.every(x=>Number.isSafeInteger(x)&&x>=0)))) {
    throw new RangeError('Use an n by n JSON array of cells with the same 1 to 8 nonnegative integer symbols per cell.');
  }
  const all=new Set(grid.flat(2)), conflicts=new Set();
  for (const transpose of [false,true]) for (const i of range(n)) {
    const seen=new Map();
    for (const j of range(n)) {
      const [row,col]=transpose?[j,i]:[i,j], pos=row*n+col;
      for(const sym of grid[row][col]) {
        if (seen.has(sym)) {conflicts.add(pos);conflicts.add(seen.get(sym));}
        else seen.set(sym,pos);
      }
    }
  }
  return {n,r,valid:all.size===n*r&&conflicts.size===0,conflicts};
}
export function search(grid, allowed=null, limit=150000) {
  const n=grid.length, columns=new Set(), symbols=new Set(), trail=[];
  let best=[], nodes=0, cut=false;
  function visit(i) {
    if (best.length===n||trail.length+n-i<=best.length||cut) return;
    if (++nodes>limit) {cut=true;return;}
    if (i===n) return;
    for (const j of range(n)) if (!columns.has(j)) {
      for (const s of grid[i][j]) if ((!allowed||allowed.has(s))&&!symbols.has(s)) {
        columns.add(j);symbols.add(s);trail.push([i,j,s]);
        if (trail.length>best.length) best=trail.slice();
        visit(i+1);
        trail.pop();symbols.delete(s);columns.delete(j);
      }
    }
    visit(i+1);
  }
  visit(0);
  return {best,nodes:Math.min(nodes,limit),proved:best.length===n||!cut};
}
export function greedy(grid) {
  const takenCols=new Set(), takenSymbols=new Set(), picks=[];
  grid.forEach((row,i)=>{
    const j=row.findIndex((cell,col)=>!takenCols.has(col)&&cell.some(s=>!takenSymbols.has(s)));
    if(j<0) return;
    const s=row[j].find(x=>!takenSymbols.has(x));
    takenCols.add(j);takenSymbols.add(s);picks.push([i,j,s]);
  });
  return picks;
}
const select=(key,label,value,options,live=true)=>({key,label,value,options,type:'select',live});
const num=(key,label,value,min,max)=>({key,label,value,min,max,step:1,type:'number'});
function showGrid(parent,grid,picks=[],invalid=new Set(),onSymbol) {
  const n=grid.length, panel=board(parent,n);
  grid.forEach((row,i)=>row.forEach((cell,j)=>{
    const tile=element('div',null,panel,'tile');
    tile.classList.toggle('invalid',invalid.has(i*n+j));
    for(const s of cell) {
      const selected=picks.some(([a,b,v])=>a===i&&b===j&&v===s);
      const symbol=element(onSymbol?'button':'span',s,tile,selected?'symbol selected':'symbol');
      symbol.style.setProperty('--symbol',colors[s%colors.length]);
      if (onSymbol) {
        symbol.setAttribute('aria-label','Row '+(i+1)+', column '+(j+1)+', symbol '+s);
        symbol.setAttribute('aria-pressed',String(selected));
        symbol.onclick=()=>onSymbol(i,j,s);
      }
    }
  }));
  return panel;
}
export const app={
  title:'Latin Square Graph Explorer',description:'Trace grid symbols as colored edges between rows and columns.',
  controls:[select('n','Board order','5',['3','4','5']),select('r','Symbols per cell','2',['1','2','3'])],
  method:'Each symbol in cell (i,j) is an edge from row i to column j. A transversal becomes a matching with distinct edge colors. Parallel edges represent several symbols in one cell.',
  check(){const grid=square(5,3);if(!validate(grid).valid||grid.flat(2).length!==75||search(grid).best.length!==5)throw Error('Graph mapping');},
  render(parent,{n,r},state,redraw){
    n=+n;r=+r;
    const grid=square(n,r), picks=search(grid).best;
    const focus=state.focus?.[0]<n&&state.focus?.[1]<n&&state.focus?.[2]<n*r?state.focus:null;
    badge(parent,focus?'Focused edge · R'+(focus[0]+1)+' to C'+(focus[1]+1)+' · symbol '+focus[2]:picks.length+' edges in the highlighted matching');
    const {ctx,width,height}=surface(parent,'Bipartite graph of Latin square rows and columns',300);
    const y=i=>35+(height-70)*i/(n-1);
    for(const [i,row] of grid.entries())for(const [j,cell] of row.entries())for(const [k,s] of cell.entries()){
      const active=(focus?[focus]:picks).some(([a,b,v])=>a===i&&b===j&&v===s);
      ctx.globalAlpha=active?1:.14;ctx.strokeStyle=colors[s%colors.length];ctx.lineWidth=active?4:1;
      ctx.beginPath();ctx.moveTo(91,y(i));ctx.quadraticCurveTo(width/2,(y(i)+y(j))/2+(k-(r-1)/2)*55,width-91,y(j));ctx.stroke();
    }
    ctx.globalAlpha=1;ctx.fillStyle='#e6defe';ctx.font='16px system-ui';
    for(const i of range(n)){ctx.fillText('R'+(i+1),52,y(i)+5);ctx.fillText('C'+(i+1),width-80,y(i)+5);}
    showGrid(parent,grid,focus?[focus]:picks,new Set(),(i,j,s)=>{state.focus=[i,j,s];redraw();});
    element('button','Show matching',parent).onclick=()=>{state.focus=null;redraw();};
  }
};

function cardSolution(){
  const twice=[0,2,3,1];
  return range(16).map(i=>{const row=i>>2,col=i%4;return ((row^col)<<2)|(row^twice[col]);});
}
function cardScore(cards){
  let score=0;
  for(const column of [false,true])for(const i of range(4)){
    const group=range(4).map(j=>cards[column?j*4+i:i*4+j]);
    if(new Set(group.map(c=>c>>2)).size===4&&new Set(group.map(c=>c%4)).size===4)score++;
  }
  return score;
}
function overlap(n,m){
  const pairs=new Map();
  const grid=range(n).map(i=>range(n).map(j=>{
    const a=(i+j)%n,b=(i+m*j)%n,key=a+','+b;
    pairs.set(key,(pairs.get(key)??0)+1);
    return [a,b];
  }));
  return {grid,pairs};
}
