export function noise(length,random=Math.random){const data=new Float32Array(length);let brown=0;for(let i=0;i<length;i++){brown=(brown+.02*(random()*2-1))/1.02;data[i]=brown*3.5}return data}
export function fadeLevel(elapsed,duration){if(duration<=0)return 1;return Math.max(0,Math.min(1,(duration-elapsed)/Math.min(30,duration)))}
