export const forms={'Twelve-bar dominant':[0,0,0,0,5,5,0,0,7,5,0,7],'Quick change':[0,5,0,0,5,5,0,0,7,5,0,7],'Minor blues':[0,0,0,0,5,5,0,0,8,7,0,7],'Jazz turnaround':[0,5,0,0,5,6,0,9,2,7,0,7]};
export function progression(key,form){if(!Number.isInteger(key)||key<0||key>11||!forms[form])throw Error('Choose a valid key and form');return forms[form].map((offset,i)=>({bar:i+1,root:(key+offset)%12,quality:form==='Minor blues'&&[0,5].includes(offset)?'m7':'7'}))}
export function voicing(root,quality){return [0,quality==='m7'?3:4,7,10].map(n=>48+root+n)}
