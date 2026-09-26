export const MAX_BYTES = 160_000;
const sides = new Set(['Alliance', 'Horde', 'Unknown']);
const statuses = new Set(['held', 'neutral', 'contested', 'unconfirmed']);
function fail(message) { throw new Error(`Invalid report: ${message}`); }
function text(v, label, max = 200) { if (typeof v !== 'string' || v.length > max) fail(label); return v; }
function num(v, label) { if (!Number.isSafeInteger(v) || v < 0) fail(label); return v; }
function list(v, label, max) { if (!Array.isArray(v) || v.length > max) fail(label); return v; }
function side(v) { if (!sides.has(v)) fail('faction'); return v; }
function position(v) {
  if (v == null) return {};
  const x = num(v.x, 'map X'), y = num(v.y, 'map Y');
  if (x > 10000 || y > 10000) fail('map coordinates out of bounds');
  return { position: { x, y } };
}
// Rebuild an allowlist rather than forwarding arbitrary fields from a reporter.
export function validateReport(v) {
  if (!v || v.schemaVersion !== 1 || !['snapshot', 'live', 'demo'].includes(v.mode)) fail('schema / mode');
  const report = {
    schemaVersion: 1, mode: v.mode, generatedAt: num(v.generatedAt, 'timestamp'),
    campaignId: num(v.campaignId, 'campaign'), campaignStart: num(v.campaignStart, 'campaign start'),
    pool: text(v.pool, 'pool', 50), playerLimit: num(v.playerLimit, 'player limit'),
    fronts: list(v.fronts, 'fronts', 32).map(f => ({
      id: text(f.id, 'front ID', 80), name: text(f.name, 'front name'), lastActivityAt: num(f.lastActivityAt, 'activity'),
      ...(f.mapId == null ? {} : { mapId: num(f.mapId, 'map ID') }),
      zones: list(f.zones, 'zones', 100).map(z => {
        if (!statuses.has(z.status) || typeof z.capital !== 'boolean') fail('objective status');
        return { id: text(z.id, 'zone ID', 100), name: text(z.name, 'zone name'), owner: side(z.owner), attacker: side(z.attacker),
          status: z.status, updatedAt: num(z.updatedAt, 'zone update'), capturedAt: num(z.capturedAt, 'capture'), capital: z.capital, ...position(z.position) };
      }),
    })),
    players: list(v.players, 'players', 100).map(p => ({ name: text(p.name, 'player'), guild: text(p.guild, 'guild'),
      class: text(p.class, 'class', 40), faction: side(p.faction), kills: num(p.kills, 'kills'), captures: num(p.captures, 'captures') })),
    history: list(v.history, 'history', 12).map(h => ({ campaignStart: num(h.campaignStart, 'archive start'),
      recordedKills: num(h.recordedKills, 'archive kills'), rankedPlayers: num(h.rankedPlayers, 'archive players'), captures: num(h.captures, 'archive captures') })),
  };
  if (!report.generatedAt || report.generatedAt > Date.now() / 1000 + 300) fail('timestamp is missing or in the future');
  if (new Set(report.fronts.map(f => f.id)).size !== report.fronts.length) fail('duplicate front');
  for (const f of report.fronts) if (new Set(f.zones.map(z => z.id)).size !== f.zones.length) fail('duplicate objective');
  return report;
}
