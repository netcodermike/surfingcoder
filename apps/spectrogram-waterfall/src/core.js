export function binForFrequency(f,rate,fft){return Math.max(0,Math.min(fft/2-1,Math.round(f*fft/rate)))}
export function heat(value){const x=Math.max(0,Math.min(1,value/255));return [Math.round(255*x),Math.round(230*x*x),Math.round(100+120*x)]}
