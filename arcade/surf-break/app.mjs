import {COLS,ROWS,createGame,start,steer,pause,tick,position,key} from './engine.mjs?v=20261120-surf-break';
const $=id=>document.getElementById(id),canvas=$('ocean'),ctx=canvas.getContext('2d');
const TILE=24,W=COLS*TILE,H=ROWS*TILE,TAU=Math.PI*2;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const names=['CORAL COVE','TURTLE BAY','SUNSET REEF','MOONLIT LAGOON','HIDDEN BREAK'];
let game=createGame(),best=0,lastTime=0,accumulator=0,ridePanelState='',lastLives=-1,announcementUntil=0;
let muted=false,restartWasPlaying=false;
try{best=Number(localStorage.getItem('surf-break-best'))||0;}catch{}

class SurfAudio{
  constructor(){this.ctx=null;this.master=null;this.note=0;this.lastPearl=0;this.musicSource=null;this.musicOffset=0;}
  async wake(){
    if(muted)return;
    try{
      if(!this.ctx){
        this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=.5;this.master.connect(this.ctx.destination);
        const len=this.ctx.sampleRate*3,buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),data=buf.getChannelData(0);let brown=0;
        for(let i=0;i<len;i++){brown=(brown+(Math.random()*2-1)*.02)/1.02;data[i]=brown*3.5;}
        const noise=this.ctx.createBufferSource();noise.buffer=buf;noise.loop=true;const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=640;
        this.sea=this.ctx.createGain();this.sea.gain.value=.065;noise.connect(filter);filter.connect(this.sea);this.sea.connect(this.master);noise.start();
        const lfo=this.ctx.createOscillator(),depth=this.ctx.createGain();lfo.frequency.value=.16;depth.gain.value=.025;lfo.connect(depth);depth.connect(this.sea.gain);lfo.start();
      }
      await this.ctx.resume();this.master.gain.setTargetAtTime(.5,this.ctx.currentTime,.04);
      this.wipeoutPromise??=fetch($('wipeout-audio').src).then(r=>{if(!r.ok)throw new Error('Wipeout sound unavailable');return r.arrayBuffer();}).then(b=>this.ctx.decodeAudioData(b)).then(buffer=>{this.wipeoutBuffer=buffer;}).catch(()=>{});
      this.musicPromise??=fetch($('swell-music').src).then(r=>{if(!r.ok)throw new Error('Music unavailable');return r.arrayBuffer();}).then(b=>this.ctx.decodeAudioData(b)).then(buffer=>{this.musicBuffer=buffer;}).catch(()=>{});
    }catch{}
  }
  hush(){if(this.ctx)this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.06);this.stopMusic(true);if(this.wipeoutSource){try{this.wipeoutSource.stop();}catch{}this.wipeoutSource=null;}}
  stopMusic(preserve=false){
    if(this.musicSource){
      const now=this.ctx.currentTime;
      if(preserve)this.musicOffset=(this.musicOffset+now-this.musicStarted)%this.musicBuffer.duration;
      this.musicGain.gain.cancelScheduledValues(now);this.musicGain.gain.setTargetAtTime(0,now,.055);
      try{this.musicSource.stop(now+.22);}catch{}
      this.musicSource=null;
    }
    if(!preserve)this.musicOffset=0;
  }
  syncSwell(powered,playing){
    if(!powered){this.stopMusic(false);return;}
    if(!playing||muted){this.stopMusic(true);return;}
    if(this.musicSource||!this.musicBuffer||this.ctx?.state!=='running')return;
    const now=this.ctx.currentTime,source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
    source.buffer=this.musicBuffer;source.loop=true;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.48,now+.16);source.connect(gain);gain.connect(this.master);
    this.musicStarted=now;this.musicSource=source;this.musicGain=gain;source.start(now,this.musicOffset%this.musicBuffer.duration);
  }
  async wipeoutSound(){
    if(muted)return;
    if(!this.wipeoutBuffer)await this.wipeoutPromise;
    if(muted||!this.wipeoutBuffer||this.ctx?.state!=='running')return;
    return new Promise(resolve=>{
      if(this.wipeoutSource){try{this.wipeoutSource.stop();}catch{}}
      const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
      source.buffer=this.wipeoutBuffer;gain.gain.value=.95;source.connect(gain);gain.connect(this.master);this.wipeoutSource=source;
      source.onended=()=>{if(this.wipeoutSource===source)this.wipeoutSource=null;resolve();};
      try{source.start();}catch{this.wipeoutSource=null;resolve();}
    });
  }
  horn(){
    if(muted||!this.ctx||this.ctx.state!=='running')return;
    const t=this.ctx.currentTime;
    for(const [frequency,volume,type] of [[220,.18,'sawtooth'],[277.18,.065,'sawtooth'],[440,.035,'square']]){
      const osc=this.ctx.createOscillator(),gain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();osc.type=type;osc.frequency.setValueAtTime(frequency,t);filter.type='lowpass';filter.frequency.value=1600;gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.035);gain.gain.setValueAtTime(volume,t+1.05);gain.gain.exponentialRampToValueAtTime(.0001,t+1.5);osc.connect(filter);filter.connect(gain);gain.connect(this.master);osc.start(t);osc.stop(t+1.55);
    }
  }
  tone(freq,time=.16,delay=0,volume=.12,type='sine'){
    if(muted||!this.ctx||this.ctx.state!=='running')return;
    const t=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+time);osc.connect(gain);gain.connect(this.master);osc.start(t);osc.stop(t+time+.02);
  }
  splash(){
    if(muted||!this.ctx)return;
    const t=this.ctx.currentTime,source=this.ctx.createBufferSource(),buf=this.ctx.createBuffer(1,this.ctx.sampleRate*.65,this.ctx.sampleRate),b=buf.getChannelData(0);
    for(let i=0;i<b.length;i++)b[i]=(Math.random()*2-1)*(1-i/b.length);
    source.buffer=buf;const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(1700,t);f.frequency.exponentialRampToValueAtTime(180,t+.6);const v=this.ctx.createGain();v.gain.value=.19;source.connect(f);f.connect(v);v.connect(this.master);source.start();
  }
  play(event){
    if(event==='pearl'){const now=performance.now();if(now-this.lastPearl<90)return;this.lastPearl=now;this.tone([523.25,659.25,783.99,880,1046.5][this.note++%5],.12,0,.09);}
    if(event==='wave'){this.stopMusic(false);this.splash();}
    if(event==='catch'){[659.25,880,1046.5].forEach((n,i)=>this.tone(n,.23,i*.055,.12));}
    if(event==='bonus'||event==='clear'){[523.25,659.25,783.99,1046.5,1318.5].forEach((n,i)=>this.tone(n,.4,i*.09,.13));}
    if(event==='wipeout')return this.wipeoutSound();
    if(event==='countdown')this.tone(440,.13,0,.045,'sine');
    if(event==='horn')this.horn();
  }
}
const audio=new SurfAudio();
function syncSound(){ $('sound').setAttribute('aria-pressed',String(!muted));$('sound').innerHTML=muted?'♫ <span>Sound off</span>':'♫ <span>Sound on</span>';}
function toggleSound(){muted=!muted;syncSound();if(muted)audio.hush();else audio.wake();}
const round=(c,x,y,w,h,r,fill,stroke)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
const ellipse=(c,x,y,rx,ry,color)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();};
function curve(c,points,color,width){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function enemy(c,kind,x,y,t,scared=false,size=1,heading='left'){
  c.save();c.translate(x,y);c.scale(size,size);if(heading==='right')c.scale(-1,1);
  const colors=['#a5f4e1','#fc9fda','#ffc88b','#d5b1fa'],color=scared?'#9eedc4':colors[kind];
  if(scared){ellipse(c,0,0,13,13,'#97ffd21b');c.strokeStyle='#b9ffd4';c.lineWidth=.7;c.beginPath();c.arc(0,0,13+Math.sin(t*5)*1,0,TAU);c.stroke();}
  ellipse(c,1,8,9,3,'#00192455');
  if(kind===0){
    c.beginPath();c.moveTo(-13,0);c.quadraticCurveTo(-5,-9,6,-5);c.lineTo(13,-10);c.lineTo(11,-2);c.lineTo(14,5);c.lineTo(6,3);c.quadraticCurveTo(-5,8,-13,0);c.fillStyle=color;c.fill();
    c.beginPath();c.moveTo(-1,-4);c.lineTo(1,-12);c.lineTo(6,-4);c.fill();
    curve(c,[[-8,3],[-3,4],[0,3]],'#e9f5e5',1.5);ellipse(c,-6,-2,1.3,1.3,'#10303c');ellipse(c,-6.3,-2.3,.4,.4,'#fff');
  }else if(kind===1){
    for(let i=0;i<4;i++){c.beginPath();c.moveTo(-7+i*4,2);c.bezierCurveTo(-9+i*4,7,-3+i*4+Math.sin(t*5+i)*3,8,-7+i*4,13);c.strokeStyle=scared?'#93e9ba':'#e29cd3';c.lineWidth=1.6;c.stroke();}
    c.beginPath();c.moveTo(-11,2);c.bezierCurveTo(-10,-14,10,-14,11,2);c.quadraticCurveTo(0,7,-11,2);c.fillStyle=color;c.fill();ellipse(c,-4,-4,3,1.5,'#fff5');ellipse(c,-4,0,1.2,1.3,'#27314a');ellipse(c,4,0,1.2,1.3,'#27314a');
  }else if(kind===2){
    for(const side of [-1,1]){for(let i=0;i<3;i++)curve(c,[[side*6,1+i*2],[side*(10+i%2*2),3+i*3],[side*13,2+i*4+Math.sin(t*7)*1]],color,1.5);curve(c,[[side*7,-1],[side*12,-5],[side*11,-9]],color,2);ellipse(c,side*12,-8,3.3,3.5,color);ellipse(c,side*13,-10,1.2,2,'#102f3a');}
    ellipse(c,0,1,9,6.5,color);for(const s of [-1,1]){curve(c,[[s*4,-3],[s*5,-7]],color,2);ellipse(c,s*5,-7,2,2,'#fff0d1');ellipse(c,s*5,-7,.9,1,'#213940');}
  }else{
    curve(c,[[5,4],[12,7],[15,13]],color,1.3);c.beginPath();c.moveTo(-12,-7+Math.sin(t*4));c.quadraticCurveTo(-5,-2,0,-7);c.quadraticCurveTo(5,-2,12,-7+Math.sin(t*4));c.quadraticCurveTo(9,4,1,8);c.quadraticCurveTo(-9,4,-12,-7);c.fillStyle=color;c.fill();ellipse(c,-3,-2,1,1,'#263449');ellipse(c,3,-2,1,1,'#263449');curve(c,[[-1,3],[0,4],[1,3]],'#e8ddff',.8);
  }
  if(scared){curve(c,[[-3,4],[0,2],[3,4]],'#174e44',.8);}
  c.restore();
}
function surfer(c,x,y,dir,t,power=false,alpha=1){
  c.save();c.globalAlpha=alpha;c.translate(x,y);
  let angle={right:0,down:Math.PI/2,left:0,up:-Math.PI/2}[dir]||0;c.rotate(angle);if(dir==='left')c.scale(-1,1);
  const bob=reduced?0:Math.sin(t*13)*.6;
  c.lineWidth=.8;
  for(let i=0;i<3;i++)curve(c,[[-15-i*3,-1-i*2],[-19-i*3,-2-i*2],[-22-i*2,-1-i*2]],power?'#c8ffe880':'#96d9d65a',.8);
  ellipse(c,0,7,14,5,'#001d2b66');
  c.beginPath();c.moveTo(15,5);c.bezierCurveTo(9,-2,-9,0,-13,5);c.bezierCurveTo(-9,11,8,12,15,5);c.fillStyle=power?'#c6ffb4':'#d9c4f5';c.fill();
  curve(c,[[-10,5],[11,5]],'#a879e8',1.7);curve(c,[[-8,7],[8,7]],'#fff1c28a',.7);
  c.translate(0,bob);
  curve(c,[[-3,0],[-6,3],[-6,5]],'#edb582',2.7);curve(c,[[2,0],[5,2],[7,4]],'#edb582',2.7);
  round(c,-4,-4,7,5,1.2,'#e9836d');curve(c,[[-3,-3],[2,-3]],'#ffd6ab',.6);
  ellipse(c,0,-6,3.7,4,'#f7c894');curve(c,[[0,-7],[5,-5],[8,-7]],'#f7c894',2.2);curve(c,[[-1,-7],[-6,-5],[-9,-7]],'#f7c894',2.2);
  ellipse(c,2,-11,3.5,3.8,'#f4c18e');c.beginPath();c.moveTo(-1,-11);c.lineTo(-2,-14);c.quadraticCurveTo(2,-17,6,-13);c.lineTo(4,-12);c.lineTo(1,-13);c.lineTo(1,-10);c.closePath();c.fillStyle='#ffdf83';c.fill();
  ellipse(c,4,-11,.65,.8,'#16333c');c.restore();
}
function pineapple(c,x,y,t){
  c.save();c.translate(x,y+Math.sin(t*4)*1.5);ellipse(c,0,2,6,8,'#efbb59');
  c.save();c.beginPath();c.ellipse(0,2,6,8,0,0,TAU);c.clip();for(let i=-12;i<12;i+=4){curve(c,[[i,-6],[i+15,10]],'#b5833e',.7);curve(c,[[i,10],[i+15,-6]],'#b5833e',.7);}c.restore();
  for(const [tx,ty] of [[-6,-10],[-2,-13],[2,-13],[6,-10]]){c.beginPath();c.moveTo(0,-4);c.quadraticCurveTo(tx,ty+3,tx,ty);c.lineTo(2,-4);c.fillStyle='#a6dca0';c.fill();}c.restore();
}
function makeReef(){
  const layer=document.createElement('canvas');layer.width=W;layer.height=H;const c=layer.getContext('2d');
  c.fillStyle='#1d1924';c.fillRect(0,0,W,H);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    if(!game.grid[y][x])continue;
    const px=x*TILE,py=y*TILE;
    const edges=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>game.grid[y+dy]?.[x+dx]===0);
    c.fillStyle='#302839';c.fillRect(px,py,TILE,TILE);
    if(!edges.some(Boolean)){
      const n=((x*71+y*37+game.level*13)%23);
      if(n<3&&x>0&&x<COLS-1&&y>0&&y<ROWS-1){
        const col=['#bd96ef50','#a879e860','#d9c4f560'][n];
        curve(c,[[px+12,py+17],[px+12,py+7]],col,2);curve(c,[[px+6,py+8],[px+7,py+12],[px+12,py+14],[px+16,py+11],[px+17,py+6]],col,1.5);
      }else{ellipse(c,px+6+(x%3)*4,py+8+(y%3)*3,1,1,'#d9c4f524');}
    }
    c.lineWidth=2;c.strokeStyle='#9276ac';c.lineCap='round';
    if(edges[0]){c.beginPath();c.moveTo(px,py+1);c.lineTo(px+TILE,py+1);c.stroke();}
    if(edges[1]){c.beginPath();c.moveTo(px+TILE-1,py);c.lineTo(px+TILE-1,py+TILE);c.stroke();}
    if(edges[2]){c.beginPath();c.moveTo(px,py+TILE-1);c.lineTo(px+TILE,py+TILE-1);c.stroke();}
    if(edges[3]){c.beginPath();c.moveTo(px+1,py);c.lineTo(px+1,py+TILE);c.stroke();}
    c.lineWidth=1;c.strokeStyle='#d9c4f52b';
    if(edges[0]){c.beginPath();c.moveTo(px,py+4);c.lineTo(px+TILE,py+4);c.stroke();}
    if(edges[2]){c.beginPath();c.moveTo(px,py+TILE-4);c.lineTo(px+TILE,py+TILE-4);c.stroke();}
  }
  return layer;
}
let reef=makeReef(),renderLevel=1;
function draw(now){
  if(renderLevel!==game.level){reef=makeReef();renderLevel=game.level;}
  ctx.clearRect(0,0,W,H);ctx.drawImage(reef,0,0);
  const time=reduced?0:now*.001;
  ctx.save();
  // Sparse glints in the channels, kept behind the collectibles.
  for(let i=0;i<42;i++){
    const x=(i*97+19)%COLS,y=(i*41+3)%ROWS;if(game.grid[y][x])continue;
    const flicker=.12+Math.sin(time*1.8+i)*.08;
    curve(ctx,[[x*TILE+3,y*TILE+17],[x*TILE+8,y*TILE+16],[x*TILE+12,y*TILE+17]],`rgba(189,150,239,${flicker})`,.8);
  }
  for(const k of game.pearls){const [x,y]=k.split(',').map(Number);ellipse(ctx,(x+.5)*TILE,(y+.5)*TILE,2.15,2.15,'#f0eaf6');ellipse(ctx,(x+.5)*TILE-.5,(y+.5)*TILE-.7,.65,.65,'#fff');}
  for(const k of game.powers){const [x,y]=k.split(',').map(Number),px=(x+.5)*TILE,py=(y+.5)*TILE;
    ellipse(ctx,px,py,9+Math.sin(time*3)*1,9+Math.sin(time*3)*1,'#9bffe317');ctx.strokeStyle='#7fe6d4';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,8.5,0,TAU);ctx.stroke();
    ctx.beginPath();ctx.moveTo(px-5,py+2);ctx.bezierCurveTo(px-1,py+3,px-1,py-5,px+3,py-3);ctx.bezierCurveTo(px+6,py-1,px+2,py+2,px+1,py);ctx.strokeStyle='#bcffe9';ctx.lineWidth=2;ctx.stroke();
  }
  if(game.bonus&&(game.bonus.time>4||Math.floor(time*5)%2))pineapple(ctx,(game.bonus.x+.5)*TILE,(game.bonus.y+.5)*TILE,time);
  const riding=['playing','wipeout'].includes(game.state);
  for(const e of game.enemies){
    const p=position(e);ctx.globalAlpha=riding&&e.rest>0?.3:1;
    for(const offset of [0,-W,W])enemy(ctx,e.kind,(p.x+.5)*TILE+offset,(p.y+.5)*TILE,time,game.power>0&&e.rest<=0,1,e.dir);
  }
  ctx.globalAlpha=1;
  const p=position(game.player),alpha=game.state==='wipeout'?Math.max(0,game.wipeout/1.5):riding&&game.safe>0&&Math.floor(time*8)%2?.5:1;
  for(const offset of [0,-W,W])surfer(ctx,(p.x+.5)*TILE+offset,(p.y+.5)*TILE,game.player.dir,time,game.power>0,alpha);
  if(game.state==='wipeout'){
    const age=1.5-game.wipeout;ctx.beginPath();ctx.arc((p.x+.5)*TILE,(p.y+.5)*TILE,age*34+6,0,TAU);ctx.strokeStyle=`rgba(215,245,232,${Math.max(0,1-age)})`;ctx.lineWidth=2;ctx.stroke();
  }
  for(const pop of game.popups){ctx.globalAlpha=Math.min(1,pop.life*2);ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillStyle=pop.color;ctx.fillText(pop.text,(pop.x+.5)*TILE,(pop.y+.5)*TILE-18-(1.1-pop.life)*18);}
  ctx.restore();
}
function announce(text,seconds=3){$('status').textContent=text;announcementUntil=game.time+seconds;}
function sync(){
  const swellOn=game.power>0&&game.state==='playing';
  const summerMode=document.querySelector('.session-tag');summerMode.classList.toggle('is-active',swellOn);summerMode.title=swellOn?'Surf’s up! Super Swell is active.':'New reef mazes keep rolling in after every cleared round.';
  $('score').textContent=String(game.score).padStart(6,'0');$('level').textContent=String(game.level).padStart(2,'0');
  if(game.score>best){best=game.score;try{localStorage.setItem('surf-break-best',String(best));}catch{}}
  $('best').textContent=String(best).padStart(6,'0');$('remaining').textContent=`${game.pearls.size+game.powers.size} left`;$('lagoon').textContent=names[(game.level-1)%names.length];
  if(lastLives!==game.lives){$('lives').innerHTML=Array.from({length:3},(_,i)=>`<span class="board-life ${i>=game.lives?'lost':''}"></span>`).join('');$('lives').setAttribute('aria-label',`${game.lives} boards left`);lastLives=game.lives;}
  $('pause').disabled=!['playing','countdown','paused'].includes(game.state);$('pause').innerHTML=game.state==='paused'?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>';
  $('power-strip').hidden=game.power<=0||game.state!=='playing';$('power-meter').style.width=`${Math.min(100,game.power/8.25*100)}%`;$('power-seconds').textContent=`${Math.ceil(game.power)}s`;
  if(game.state==='playing'&&game.time>announcementUntil)$('status').textContent=!game.player.dir?'Choose a direction to catch your wave.':game.power>0?'Ride the swell. Chase them back!':'Find your line. Gather the pearls.';
  const rideState=game.state==='countdown'? `countdown:${Math.ceil(game.countdownRemaining)}`:game.state;
  if(ridePanelState!==rideState){
    ridePanelState=rideState;
    const states={
      ready:game.level===1?['Your wave is waiting.','Catch a wave']:['A new reef is ready.','Ride the next break'],
      countdown:[`Starting in ${Math.ceil(game.countdownRemaining)}…`],
      playing:['Collect every pearl.'],
      paused:['Between the waves.','Keep riding'],
      wipeout:['Wipeout!'],
      over:[`Ride complete · ${game.score.toLocaleString()} points`,'Surf again'],
      cleared:[`Break ${game.level} cleared · +${1000*game.level}`]
    };
    const [message,action]=states[game.state];
    $('ride-status').textContent=message;
    const playButton=$('play');
    playButton.hidden=!action;
    if(action)playButton.textContent=action;
  }
}
function play(){
  if(game.state==='over')game=createGame();
  const resuming=game.state==='paused';
  if(resuming)pause(game);else start(game,3);
  audio.wake().then(()=>{if(!resuming&&game.state==='countdown')audio.play('countdown');});accumulator=0;sync();canvas.focus({preventScroll:true});
}
function togglePause(){const was=game.state;pause(game);if(game.state==='paused')audio.hush();else if(was==='paused')audio.wake();accumulator=0;sync();}
function fresh(){
  if(['ready','over'].includes(game.state)){game=createGame();reef=makeReef();renderLevel=1;sync();return;}
  restartWasPlaying=['playing','countdown'].includes(game.state);if(restartWasPlaying)togglePause();
  $('restart-dialog').showModal();
}
function frame(now){
  const dt=Math.min(.05,(now-lastTime)/1000||0);lastTime=now;accumulator+=dt;
  while(accumulator>=1/120){
    for(const event of tick(game,1/120)){
      if(event==='wipeout'&&game.lives>0){
        const injuredGame=game;
        injuredGame.wipeoutAudioPending=true;
        Promise.resolve(audio.play(event)).catch(()=>{}).finally(()=>{injuredGame.wipeoutAudioPending=false;});
      }else audio.play(event);
      if(event==='wave')announce('Super swell! The locals are on the run.',8);
      if(event==='catch')announce('Nice ride! Keep the combo going.',2);
      if(event==='fruit')announce('A golden pineapple washed in!',4);
      if(event==='bonus')announce('A sweet little detour.',3);
      if(event==='wipeout')announce(game.lives?'Wipeout! A fresh board is coming.':'There’s always another wave.',3);
    }
    accumulator-=1/120;
  }
  audio.syncSwell(game.power>0,game.state==='playing');draw(now);sync();requestAnimationFrame(frame);
}
const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'};
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]'))return;
  if(e.ctrlKey||e.altKey||e.metaKey||e.target.closest?.('.sc-site-header,.arcade-lobby,input,textarea,select'))return;
  if(keys[e.code]){e.preventDefault();steer(game,keys[e.code]);}
  if((e.code==='KeyP'||e.code==='Escape')&&!e.repeat){e.preventDefault();togglePause();}
  if(e.code==='KeyM'&&!e.repeat){e.preventDefault();toggleSound();}
  if((e.code==='Enter'||e.code==='Space')&&!e.repeat&&!e.target.closest('button,a')){e.preventDefault();if(['ready','over','paused'].includes(game.state))play();}
});
$('play').addEventListener('click',play);$('pause').addEventListener('click',togglePause);$('sound').addEventListener('click',toggleSound);$('restart').addEventListener('click',fresh);
$('confirm-restart').addEventListener('click',()=>{ $('restart-dialog').close();game=createGame();reef=makeReef();renderLevel=1;announcementUntil=0;sync(); });
$('cancel-restart').addEventListener('click',()=>{ $('restart-dialog').close();if(restartWasPlaying&&game.state==='paused')togglePause();restartWasPlaying=false; });
let wasPlayingBeforeHelp=false;
$('help').addEventListener('click',()=>{wasPlayingBeforeHelp=['playing','countdown'].includes(game.state);if(wasPlayingBeforeHelp)togglePause();$('help-dialog').showModal();});
function closeHelp(){ $('help-dialog').close(); }
$('close-help').addEventListener('click',closeHelp);$('help-done').addEventListener('click',closeHelp);
$('help-dialog').addEventListener('close',()=>{if(wasPlayingBeforeHelp&&game.state==='paused')togglePause();wasPlayingBeforeHelp=false;});
document.addEventListener('arcade:open-rom',()=>{if(['playing','countdown'].includes(game.state))togglePause();audio.hush();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(['playing','countdown'].includes(game.state))togglePause();audio.hush();}});
window.addEventListener('blur',()=>{if(['playing','countdown'].includes(game.state))togglePause();});
for(const b of document.querySelectorAll('[data-dir]')){
  const turn=()=>{steer(game,b.dataset.dir);canvas.focus({preventScroll:true});};
  b.addEventListener('pointerdown',e=>{e.preventDefault();turn();});
  b.addEventListener('click',turn);
}
let touchStart=null;
canvas.addEventListener('pointerdown',e=>{touchStart={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;if(Math.hypot(dx,dy)<12)return;steer(game,Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');touchStart={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',()=>{touchStart=null;});canvas.addEventListener('pointercancel',()=>{touchStart=null;});
for(const p of document.querySelectorAll('.portrait'))enemy(p.getContext('2d'),Number(p.dataset.kind),36,30,0,false,2);
function resize(){const ratio=Math.min(2,devicePixelRatio||1);canvas.width=W*ratio;canvas.height=H*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);draw(performance.now());}
window.addEventListener('resize',resize);resize();syncSound();sync();requestAnimationFrame(frame);
