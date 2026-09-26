// Deliberately fictional scores. Never loaded as a fallback for a failed live feed.
import { demoGeography } from './demo-geography.js';
export function demoReport() {
  const now = Math.floor(Date.now() / 1000);
  return { schemaVersion: 1, mode: 'demo', generatedAt: now, campaignId: 42, campaignStart: now - 345600, pool: 'Demo realm', playerLimit: 100,
    fronts: Object.entries(demoGeography).map(([id,{name,mapId,zones}], fi) => ({ id, name, mapId, lastActivityAt: now-[35,95,210,1800,3600,290,7200][fi], zones: zones.map((zone,i) => ({
      ...zone, status: i === 3 && fi < 2 ? 'contested' : i === 6 ? 'neutral' : 'held',
      owner: i === 6 ? 'Unknown' : i < zones.length/2 ? 'Alliance' : 'Horde',
      attacker: i === 3 && fi < 2 ? 'Horde' : 'Unknown', updatedAt: now-240, capturedAt: now-2400,
    })) })),
    players: [['Aeloria','Silver Covenant','Alliance','PALADIN',284,16],['Gorvash','Iron Oath','Horde','WARRIOR',267,19],['Thornvale','Silver Covenant','Alliance','HUNTER',231,12],['Nyssera','Ashen Guard','Horde','ROGUE',218,9],['Caeldren','Dawnwatch','Alliance','MAGE',195,14],['Zulrak','Iron Oath','Horde','SHAMAN',183,11],['Mirelle','Dawnwatch','Alliance','PRIEST',161,18],['Vorrak','Ashen Guard','Horde','WARLOCK',148,8]].map(([name,guild,faction,cls,kills,captures]) => ({name,guild,faction,class:cls,kills,captures})),
    history: [1,2,3].map((n) => ({campaignStart: now-345600-n*604800,recordedKills: 2400+n*731,rankedPlayers:75+n*6,captures:132+n*13})),
  };
}
