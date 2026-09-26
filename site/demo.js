// Deliberately fictional scores. Never loaded as a fallback for a failed live feed.
export function demoReport() {
  const now = Math.floor(Date.now() / 1000);
  const specs = [
    ['arathi', 'Arathi Highlands', ['Stromgarde', "Faldir’s Cove", 'Witherbark Village', "Go’Shek Farm", "Dabyrie’s Farmstead", 'Refuge Pointe', 'High Perch', 'Newstead', 'Hammerfall', "Ar’gorok"], 35],
    ['loch_modan', 'Loch Modan', ['Thelsamar', 'Valley of Kings', 'South Gate Pass', 'Farstrider Lodge', "Ironband’s Excavation", 'Silver Stream Mine', 'Algaz Station', 'Stonewrought Dam', 'The Loch', "Mo’grosh Stronghold"], 95],
    ['durotar', 'Durotar', ['Alliance Landing', 'Razor Hill', 'Sen’jin Village', 'Echo Isles', 'Skull Rock', 'Horde Stronghold'], 210],
    ['ashenvale', 'Ashenvale', ['Astranaar', 'Silverwind Refuge', 'Splintertree Post', 'Warsong Lumber Camp'], 1800],
  ];
  return { schemaVersion: 1, mode: 'demo', generatedAt: now, campaignId: 42, campaignStart: now - 345600, pool: 'Demo realm', playerLimit: 100,
    fronts: specs.map(([id,name,zones,age], fi) => ({ id, name, lastActivityAt: now-age, zones: zones.map((name,i) => ({
      id: `${id}_${i}`, name, status: i === 3 && fi < 2 ? 'contested' : i === 6 ? 'neutral' : 'held',
      owner: i === 6 ? 'Unknown' : i < zones.length/2 ? 'Alliance' : 'Horde',
      attacker: i === 3 && fi < 2 ? 'Horde' : 'Unknown', updatedAt: now-age, capturedAt: now-2400, capital: i===0 || i===zones.length-1,
    })) })),
    players: [['Aeloria','Silver Covenant','Alliance','PALADIN',284,16],['Gorvash','Iron Oath','Horde','WARRIOR',267,19],['Thornvale','Silver Covenant','Alliance','HUNTER',231,12],['Nyssera','Ashen Guard','Horde','ROGUE',218,9],['Caeldren','Dawnwatch','Alliance','MAGE',195,14],['Zulrak','Iron Oath','Horde','SHAMAN',183,11],['Mirelle','Dawnwatch','Alliance','PRIEST',161,18],['Vorrak','Ashen Guard','Horde','WARLOCK',148,8]].map(([name,guild,faction,cls,kills,captures]) => ({name,guild,faction,class:cls,kills,captures})),
    history: [1,2,3].map((n) => ({campaignStart: now-345600-n*604800,recordedKills: 2400+n*731,rankedPlayers:75+n*6,captures:132+n*13})),
  };
}
