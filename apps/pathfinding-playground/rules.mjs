export function search(grid           , start      , goal      , algorithm                         )        {
  const height=grid.length,width=grid[0]?.length??0;
  if(!width||grid.some(row=>row.length!==width||row.some(x=>!Number.isFinite(x)||x<0)))throw Error('Invalid grid');
  const inside=([x,y]      )=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<width&&y<height;
  if(!inside(start)||!inside(goal)||!grid[start[1]][start[0]]||!grid[goal[1]][goal[0]])throw Error('Endpoints must be walkable grid cells');
  if(!['bfs','dijkstra','astar'].includes(algorithm))throw Error('Unknown algorithm');
  const key=([x,y]      )=>`${x},${y}`;
  const minWeight=Math.min(...grid.flat().filter(v=>v>0));
  const heuristic=(p      )=>algorithm==='astar'?(Math.abs(p[0]-goal[0])+Math.abs(p[1]-goal[1]))*minWeight:0;
  const distances=new Map               ([[key(start),0]]),parents=new Map              ();
  const queue                         =[{p:start,score:heuristic(start)}],visited        =[];const closed=new Set        ();
  while(queue.length){
    if(algorithm!=='bfs')queue.sort((a,b)=>a.score-b.score);
    const current=queue.shift() .p,k=key(current);if(closed.has(k))continue;closed.add(k);visited.push(current);
    if(k===key(goal)){
      const path=[current];let cursor=current;
      while(key(cursor)!==key(start)){cursor=parents.get(key(cursor)) ;path.push(cursor);}
      return {path:path.reverse(),visited,cost:distances.get(k) };
    }
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next      =[current[0]+dx,current[1]+dy];if(!inside(next)||!grid[next[1]][next[0]])continue;
      const nk=key(next),cost=distances.get(k) +(algorithm==='bfs'?1:grid[next[1]][next[0]]);
      if(cost<(distances.get(nk)??Infinity)){distances.set(nk,cost);parents.set(nk,current);queue.push({p:next,score:cost+heuristic(next)});}
    }
  }return {path:[],visited,cost:Infinity};
}
