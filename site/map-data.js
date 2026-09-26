// World pins are approximate navigation anchors on the illustrated world map.
// Objective positions always come from the report, never these anchors.
export const atlas = {
  arathi: { name: 'Arathi Highlands', point: [78.3, 36.5], mapId: 1417 },
  loch_modan: { name: 'Loch Modan', point: [81.7, 54.2], mapId: 1432 },
  durotar: { name: 'Durotar', point: [32.3, 43.5], mapId: 1411 },
  ashenvale: { name: 'Ashenvale', point: [25.8, 30.7], mapId: 1440 },
  elwynn: { name: 'Elwynn Forest', point: [76.7, 65.5], mapId: 1429 },
  redridge: { name: 'Redridge Mountains', point: [82.5, 64.0], mapId: 1433 },
  hillsbrad: { name: 'Hillsbrad Foothills', point: [73.7, 32.0], mapId: 1424 },
};
export function objectiveState(zone) {
  if (zone.status === 'contested') return 'contested';
  if (zone.status === 'held' && zone.owner !== 'Unknown') return zone.owner.toLowerCase();
  return 'unknown';
}
export function objectiveDescription(zone) {
  if (zone.status === 'contested') return `${zone.attacker === 'Unknown' ? 'Unknown faction' : zone.attacker} attacking · ${zone.owner === 'Unknown' ? 'no confirmed defender' : zone.owner + ' defending'}`;
  if (zone.status === 'unconfirmed') return 'Awaiting confirmation';
  if (zone.status === 'neutral') return 'Neutral objective';
  return zone.owner === 'Unknown' ? 'Owner unconfirmed' : `${zone.owner} control`;
}
export function objectivePoint(position) {
  return [668 * (1 - position.y / 10000), 1022 * position.x / 10000];
}
