// Development-only: copy factual objective names/coordinates from the installed
// addon into demo fixtures. No saved variables or player information are read.
import {readFile,writeFile} from 'node:fs/promises';
import {atlas} from '../site/map-data.js';
const source=(await readFile(new URL('../../Fronts.lua',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const names=await readFile(new URL('../../Locales.lua',import.meta.url),'utf8');
const extraNames={redridge_lakeshire:'Lakeshire',redridge_althers_mill:"Alther's Mill",redridge_ilgalar:'Tower of Ilgalar',redridge_three_corners:'Three Corners',redridge_lakeridge_highway:'Lakeridge Highway',redridge_stonewatch_falls:'Stonewatch Falls',redridge_renders_valley:"Render's Valley",hillsbrad_southshore:'Southshore',hillsbrad_tarren_mill:'Tarren Mill'};
const data={};
for(const [id,entry] of Object.entries(atlas)){
  const start=source.indexOf(`\n    ${id} = {\n`);if(start<0)throw new Error(`Missing front ${id}`);
  const next=source.slice(start+1).search(/\n    \w+ = \{\n        id =/);
  const block=source.slice(start,next<0?source.indexOf('\nOverlord.Fronts.Order',start):start+1+next);
  const zones=[];
  for(const match of block.matchAll(/Zone\("([^"]+)",\s*\{\s*center\s*=\s*\{([\d.]+),\s*([\d.]+)\}([\s\S]*?)\}\)/g)){
    const [,zoneId,x,y,opts]=match;
    const label=names.match(new RegExp(`\\b${zoneId}\\s*=\\s*"([^"]+)"`))?.[1] || extraNames[zoneId];
    if(!label)throw new Error(`Missing English name ${zoneId}`);
    zones.push({id:zoneId,name:label,position:{x:Math.round(Number(x)*100),y:Math.round(Number(y)*100)},capital:/isCapital\s*=\s*true/.test(opts)});
  }
  if(!zones.length)throw new Error(`No objectives for ${id}`);
  data[id]={name:entry.name,mapId:entry.mapId,zones};
}
await writeFile(new URL('../site/demo-geography.js',import.meta.url),'// Factual map coordinates from the addon registry; demo ownership/scores are fictional.\nexport const demoGeography = '+JSON.stringify(data,null,2)+';\n');
console.log(`${Object.keys(data).length} fronts, ${Object.values(data).reduce((n,f)=>n+f.zones.length,0)} objectives`);
