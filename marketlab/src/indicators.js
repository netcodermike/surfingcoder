export const defaults={sma:20,ema:20,bands:20,k:2,rsi:14,fast:12,slow:26,signal:9};
function period(n){if(!Number.isInteger(n)||n<2||n>250)throw Error('Periods must be whole numbers from 2 to 250.');}
export function validateSettings(input){
 const s={...defaults,...input};for(const key of ['sma','ema','bands','rsi','fast','slow','signal'])period(s[key]);
 if(s.fast>=s.slow)throw Error('MACD fast period must be smaller than the slow period.');
 if(!Number.isFinite(s.k)||s.k<.1||s.k>5)throw Error('Band multiplier must be from 0.1 to 5.');return s;
}
function prices(values){if(!Array.isArray(values)||values.some(x=>!Number.isFinite(x)||x<=0||x>1e9))throw Error('Closing prices must be finite, positive, and at most one billion.');}
export function sma(values,n){period(n);prices(values);return values.map((_,i)=>i<n-1?null:values.slice(i-n+1,i+1).reduce((s,x)=>s+x,0)/n);}
export function ema(values,n){
 period(n);prices(values);const out=Array(values.length).fill(null);if(values.length<n)return out;
 const alpha=2/(n+1);out[n-1]=values.slice(0,n).reduce((s,x)=>s+x,0)/n;
 for(let i=n;i<values.length;i++)out[i]=alpha*values[i]+(1-alpha)*out[i-1];return out;
}
// Population standard deviation: divisor n, not n-1.
export function bollinger(values,n,k){
 period(n);prices(values);if(!Number.isFinite(k)||k<=0)throw Error('Band multiplier must be positive.');
 const middle=sma(values,n),sd=middle.map((mean,i)=>mean===null?null:Math.sqrt(values.slice(i-n+1,i+1).reduce((s,x)=>s+(x-mean)**2,0)/n));
 return {middle,sd,upper:middle.map((v,i)=>v===null?null:v+k*sd[i]),lower:middle.map((v,i)=>v===null?null:v-k*sd[i]),bandwidth:middle.map((v,i)=>v===null?null:100*2*k*sd[i]/v),percentB:middle.map((v,i)=>v===null||sd[i]===0?null:(values[i]-(v-k*sd[i]))/(2*k*sd[i]))};
}
export function rsi(values,n){
 period(n);prices(values);const out=Array(values.length).fill(null);if(values.length<=n)return out;
 let gain=0,loss=0;for(let i=1;i<=n;i++){const d=values[i]-values[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0);}gain/=n;loss/=n;
 const value=()=>gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);out[n]=value();
 for(let i=n+1;i<values.length;i++){const delta=values[i]-values[i-1];gain=(gain*(n-1)+Math.max(delta,0))/n;loss=(loss*(n-1)+Math.max(-delta,0))/n;out[i]=value();}return out;
}
// EMA of valid MACD values; MACD can be zero or negative, so this is separate from price EMA.
function signalEMA(values,n){const out=Array(values.length).fill(null),start=values.findIndex(Number.isFinite);if(start<0||values.length-start<n)return out;
 let seed=0;for(let i=start;i<start+n;i++)seed+=values[i];out[start+n-1]=seed/n;
 for(let i=start+n;i<values.length;i++)out[i]=2/(n+1)*values[i]+(1-2/(n+1))*out[i-1];return out;}
export function macd(values,fast,slow,signal){
 period(fast);period(slow);period(signal);if(fast>=slow)throw Error('MACD fast must be less than slow.');
 const f=ema(values,fast),s=ema(values,slow),line=values.map((_,i)=>s[i]===null?null:f[i]-s[i]),sig=signalEMA(line,signal);
 return {line,signal:sig,histogram:line.map((v,i)=>sig[i]===null?null:v-sig[i])};
}
export function indicators(values,settings=defaults){const s=validateSettings(settings);prices(values);return {sma:sma(values,s.sma),ema:ema(values,s.ema),bands:bollinger(values,s.bands,s.k),rsi:rsi(values,s.rsi),macd:macd(values,s.fast,s.slow,s.signal)};}
