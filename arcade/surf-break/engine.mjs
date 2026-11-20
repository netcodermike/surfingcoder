export const COLS=23, ROWS=25;
export const DIRECTIONS={left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}};
const opposite={left:'right',right:'left',up:'down',down:'up'};
export const key=(x,y)=>`${x},${y}`;
export function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function makeMaze(level=1){
  const random=rng(9271+level*471), grid=Array.from({length:ROWS},()=>Array(COLS).fill(1));
  const stack=[[1,1]];grid[1][1]=0;
  while(stack.length){
    const [x,y]=stack.at(-1), options=Object.values(DIRECTIONS).map(d=>[x+d.x*2,y+d.y*2,d]).filter(([nx,ny])=>nx>0&&ny>0&&nx<COLS-1&&ny<ROWS-1&&grid[ny][nx]);
    if(!options.length){stack.pop();continue;}
    const [nx,ny,d]=options[Math.floor(random()*options.length)];grid[y+d.y][x+d.x]=0;grid[ny][nx]=0;stack.push([nx,ny]);
  }
  // Add independent loops and remove interior cul-de-sacs for flowing routes.
  for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++){
    if(grid[y][x]&&((!grid[y][x-1]&&!grid[y][x+1])||(!grid[y-1][x]&&!grid[y+1][x]))&&random()<.34)grid[y][x]=0;
  }
  for(let pass=0;pass<2;pass++)for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++){
    if(grid[y][x])continue;
    const open=Object.values(DIRECTIONS).filter(d=>grid[y+d.y][x+d.x]===0);
    if(open.length===1){
      const options=Object.values(DIRECTIONS).filter(d=>x+d.x*2>0&&x+d.x*2<COLS-1&&y+d.y*2>0&&y+d.y*2<ROWS-1&&grid[y+d.y][x+d.x]&&grid[y+d.y*2][x+d.x*2]===0);
      if(options.length){const d=options[Math.floor(random()*options.length)];grid[y+d.y][x+d.x]=0;}
    }
  }
  // A short wraparound channel joins the two sides of the lagoon.
  const mid=11;
  for(let x=0;x<COLS;x++)grid[mid][x]=0;
  return grid;
}
function actor(x,y,dir='left'){return {x,y,dir,to:null,progress:0};}
export function position(a){return a.to?{x:a.x+a.to.dx*a.progress,y:a.y+a.to.dy*a.progress}:{x:a.x,y:a.y};}
export function neighbor(grid,x,y,dir){
  const d=DIRECTIONS[dir];if(!d)return null;
  let nx=x+d.x,ny=y+d.y;
  if(ny===11){if(nx<0)nx=COLS-1;if(nx>=COLS)nx=0;}
  if(ny<0||ny>=ROWS||nx<0||nx>=COLS||grid[ny][nx])return null;
  return {x:nx,y:ny,dx:d.x,dy:d.y};
}
export function available(grid,a){return Object.keys(DIRECTIONS).filter(d=>neighbor(grid,a.x,a.y,d));}
export function distances(grid,target){
  const out=new Map([[key(target.x,target.y),0]]),q=[target];
  for(let i=0;i<q.length;i++){
    const a=q[i],base=out.get(key(a.x,a.y));
    for(const dir of Object.keys(DIRECTIONS)){const n=neighbor(grid,a.x,a.y,dir);if(n&&!out.has(key(n.x,n.y))){out.set(key(n.x,n.y),base+1);q.push(n);}}
  }
  return out;
}
function resetActors(g){
  g.player=actor(11,23,null);g.queued=null;g.safe=2.7;
  const homes=[[1,1],[21,1],[1,21],[21,21]];
  g.enemies=homes.map(([x,y],i)=>({...actor(x,y,i%2?'down':'right'),home:{x,y},kind:i,rest:1.6+i*.85,shy:0}));
}
function fillLevel(g){
  g.grid=makeMaze(g.level);g.pearls=new Set();g.powers=new Set(['1,1','21,1','1,23','21,23']);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!g.grid[y][x]&&!g.powers.has(key(x,y)))g.pearls.add(key(x,y));
  g.pearls.delete('11,23');g.total=g.pearls.size+g.powers.size;g.power=0;g.combo=0;g.bonus=null;g.bonusTriggers=new Set();g.levelTime=0;g.clearTimer=0;resetActors(g);
}
export function createGame(){const g={level:1,score:0,lives:3,state:'ready',time:0,random:rng(341),events:[],popups:[],wipeout:0};fillLevel(g);return g;}
export function start(g,countdownSeconds=0){
  if(g.state!=='ready')return;
  g.countdownRemaining=Math.max(0,countdownSeconds);
  g.state=g.countdownRemaining>0?'countdown':'playing';
}
export function steer(g,dir){
  if(!DIRECTIONS[dir])return;
  g.queued=dir;
  const a=g.player;
  if(a.to&&opposite[a.dir]===dir){
    const from={x:a.x,y:a.y};const old=a.to;
    a.x=old.x;a.y=old.y;a.to={...from,dx:-old.dx,dy:-old.dy};a.progress=1-a.progress;a.dir=dir;
  }
}
export function pause(g){
  if(g.state==='playing'||g.state==='countdown'){g.resumeState=g.state;g.state='paused';}
  else if(g.state==='paused'){g.state=g.resumeState||'playing';delete g.resumeState;}
}
function advance(g,a,speed,dt,choose,enter){
  let budget=speed*dt;
  for(let guard=0;budget>1e-8&&guard<20;guard++){
    if(!a.to){const dir=choose(a);const to=neighbor(g.grid,a.x,a.y,dir);if(!to)break;a.dir=dir;a.to=to;a.progress=0;}
    const amount=Math.min(budget,1-a.progress);a.progress+=amount;budget-=amount;
    if(a.progress>=1-1e-8){a.x=a.to.x;a.y=a.to.y;a.to=null;a.progress=0;if(enter)enter(a);}
  }
}
function popup(g,a,text,color='#ffe6a0'){g.popups.push({...position(a),text,color,life:1.1});}
function collect(g,a){
  const k=key(a.x,a.y);
  if(g.pearls.delete(k)){g.score+=10;g.events.push('pearl');}
  if(g.powers.delete(k)){g.score+=50;g.power=Math.max(5,8.5-g.level*.25);g.combo=0;g.events.push('wave');popup(g,a,'SURF’S UP!','#89fff0');}
  if(g.bonus&&g.bonus.x===a.x&&g.bonus.y===a.y){const pts=300+g.level*100;g.score+=pts;g.bonus=null;g.events.push('bonus');popup(g,a,`+${pts}`);}
}
function enemyChoice(g,e,field){
  let options=available(g.grid,e);
  if(options.length>1)options=options.filter(d=>d!==opposite[e.dir]);
  if(!options.length)return opposite[e.dir];
  const scared=g.power>0;
  const scatter=!scared&&Math.floor(g.levelTime/13)%3===0;
  const ownField=scatter?distances(g.grid,e.home):field;
  let best=options[0],bestValue=-Infinity;
  for(const dir of options){const n=neighbor(g.grid,e.x,e.y,dir),dist=ownField.get(key(n.x,n.y))??100;let value=(scared?dist:-dist)+g.random()*(e.kind===2?4:.75);if(value>bestValue){bestValue=value;best=dir;}}
  return best;
}
function hit(g){
  g.lives--;g.power=0;g.events.push('wipeout');g.wipeout=1.5;g.wipeoutAudioPending=false;g.state='wipeout';
  if(g.lives<=0)g.events.push('over');
}
export function tick(g,dt){
  g.events=[];
  if(!Number.isFinite(dt)||dt<0)return g.events;
  dt=Math.min(dt,.05);
  if(g.state==='countdown'){
    const before=Math.ceil(g.countdownRemaining);
    g.countdownRemaining=Math.max(0,g.countdownRemaining-dt);
    if(g.countdownRemaining<1e-8){g.countdownRemaining=0;g.state='playing';g.events.push('horn');}
    else if(Math.ceil(g.countdownRemaining)<before)g.events.push('countdown');
    return g.events;
  }
  if(g.state==='wipeout'){
    g.wipeout=Math.max(0,g.wipeout-dt);
    if(g.wipeout<=0){
      if(g.lives<=0)g.state='over';
      else if(!g.wipeoutAudioPending){resetActors(g);g.state='playing';}
    }
    return g.events;
  }
  if(g.state==='cleared'){g.clearTimer-=dt;if(g.clearTimer<=0){g.level++;fillLevel(g);g.state='ready';}return g.events;}
  if(g.state!=='playing')return g.events;
  g.time+=dt;g.levelTime+=dt;g.safe=Math.max(0,g.safe-dt);g.power=Math.max(0,g.power-dt);
  g.popups=g.popups.filter(p=>(p.life-=dt)>0);
  if(g.bonus){g.bonus.time-=dt;if(g.bonus.time<=0)g.bonus=null;}
  const fraction=1-(g.pearls.size+g.powers.size)/g.total;
  for(const threshold of [.3,.7])if(fraction>=threshold&&!g.bonusTriggers.has(threshold)){
    g.bonusTriggers.add(threshold);let target={x:11,y:11};g.bonus={...target,time:16};g.events.push('fruit');
  }
  advance(g,g.player,5.2+Math.min(g.level-1,8)*.07,dt,a=>neighbor(g.grid,a.x,a.y,g.queued)?g.queued:a.dir,a=>collect(g,a));
  const field=distances(g.grid,g.player);
  for(const e of g.enemies){
    if(e.rest>0){e.rest-=dt;continue;}
    advance(g,e,(g.power?2.65:3.25+Math.min(g.level-1,10)*.12)+(e.kind===0?.12:0),dt,a=>enemyChoice(g,a,field));
    const p=position(g.player),q=position(e);let dx=Math.abs(p.x-q.x);dx=Math.min(dx,COLS-dx);
    if(Math.hypot(dx,p.y-q.y)<.68){
      if(g.power>0){const pts=200*2**Math.min(g.combo++,3);g.score+=pts;popup(g,e,`+${pts}`);Object.assign(e,actor(e.home.x,e.home.y));e.rest=3;g.events.push('catch');}
      else if(g.safe<=0){hit(g);break;}
    }
  }
  if(g.state==='playing'&&!g.pearls.size&&!g.powers.size){g.score+=1000*g.level;g.state='cleared';g.clearTimer=1.8;g.events.push('clear');}
  return g.events;
}
