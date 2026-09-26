import { validateReport, MAX_BYTES } from './schema.js';
import { demoReport } from './demo.js';
const $ = id => document.getElementById(id);
const n = new Intl.NumberFormat();
let report, selected, source = 'remote', displaySource = 'remote', feedUrl = './data/latest.json', busy = false, revision = 0;
const el = (tag, content, cls) => { const node = document.createElement(tag); if (content != null) node.textContent = content; if (cls) node.className = cls; return node; };
const date = ts => new Date(ts * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const recent = front => front.lastActivityAt > 0 && report.generatedAt - front.lastActivityAt <= 300;
function totals(front) {
  const counts = { Alliance: 0, Horde: 0, contested: 0 };
  for (const z of front.zones) { if (z.status === 'contested') counts.contested++; else if (z.status === 'held' && z.owner in counts) counts[z.owner]++; }
  return counts;
}
function notice(message = '') { $('notice').textContent = message; $('notice').hidden = !message; }
function freshness() {
  if (!report) return;
  const age = Math.max(0, Math.floor(Date.now()/1000 - report.generatedAt));
  const old = age > 60;
  $('mode').textContent = displaySource === 'demo' || report.mode === 'demo' ? 'DEMO · FICTIONAL DATA' : displaySource === 'import' ? 'LOCAL FILE · NOT PUBLISHED' : report.mode === 'live' ? (old ? 'LIVE FEED · STALE' : 'LIVE FEED · RECEIVING') : 'SAVED SNAPSHOT';
  $('freshness').textContent = displaySource === 'demo' ? 'Sample data for exploring the dashboard.' : `Observed ${date(report.generatedAt)} · ${age < 60 ? `${age}s` : `${Math.floor(age/60)}m`} ago`;
  $('campaign').textContent = `${report.pool} · Campaign ${report.campaignId}`;
}
function showFront() {
  const f = report.fronts.find(f => f.id === selected) || report.fronts[0];
  $('zones').replaceChildren();
  if (!f) { $('front-title').textContent = 'No fronts reported'; $('front-activity').textContent = ''; return; }
  selected = f.id;
  document.querySelectorAll('.front').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === selected)));
  $('front-title').textContent = f.name;
  $('front-activity').textContent = recent(f) ? 'Recent activity at report time' : 'No recent activity reported';
  for (const z of f.zones) {
    const card = el('article', null, `zone ${z.status === 'contested' ? 'contested' : z.owner.toLowerCase()}`);
    card.append(el('h3', z.name));
    card.append(el('p', z.status === 'contested' ? `${z.attacker === 'Unknown' ? 'Unknown faction' : z.attacker} attacking · ${z.owner === 'Unknown' ? 'no confirmed defender' : z.owner + ' defending'}` : z.status === 'unconfirmed' ? 'Awaiting confirmation' : z.status === 'neutral' ? 'Neutral objective' : `${z.owner} control`));
    if (z.capital) card.append(el('span', 'CAPITAL', 'tag'));
    $('zones').append(card);
  }
}
function showPlayers() {
  $('players').replaceChildren();
  const faction = $('faction').value;
  const ranked = [...report.players].sort((a,b) => b.kills-a.kills || a.name.localeCompare(b.name));
  let shown = 0;
  ranked.forEach((p, i) => {
    if (faction !== 'all' && p.faction !== faction) return;
    const tr = el('tr'); const name = el('td', p.name); name.append(el('small', p.guild || 'No guild reported'));
    tr.append(el('td', String(i+1).padStart(2,'0')), name, el('td', p.faction, p.faction.toLowerCase()), el('td', p.class.replaceAll('_',' ').toLowerCase()), el('td', n.format(p.kills)), el('td', n.format(p.captures)));
    $('players').append(tr); shown++;
  });
  $('no-players').hidden = shown > 0;
}
function render(next) {
  report = validateReport(next);
  displaySource = source;
  $('empty').hidden = true; $('dashboard').hidden = false;
  freshness();
  const sums = report.fronts.map(totals).reduce((a,c) => ({Alliance:a.Alliance+c.Alliance,Horde:a.Horde+c.Horde,contested:a.contested+c.contested}),{Alliance:0,Horde:0,contested:0});
  $('active-count').textContent = `${report.fronts.filter(recent).length} / ${report.fronts.length}`;
  $('alliance-count').textContent = n.format(sums.Alliance); $('horde-count').textContent = n.format(sums.Horde); $('contested-count').textContent = n.format(sums.contested);
  $('fronts').replaceChildren();
  for (const f of report.fronts) {
    const c = totals(f), button = el('button', null, 'front'); button.dataset.id = f.id;
    button.append(el('span', f.name, 'front-top'),el('small', `${recent(f) ? 'Recent activity' : 'Quiet / no report'} · ${c.contested} contested`));
    const bar = el('span', null, 'bar'); bar.setAttribute('aria-hidden', 'true');
    for (const [side, cls] of [['Alliance','a'],['Horde','h'],['contested','c']]) {const fill=el('span',null,cls); fill.style.width=`${100*c[side]/Math.max(1,f.zones.length)}%`;bar.append(fill);}
    button.append(bar); button.addEventListener('click', () => {selected=f.id;showFront();}); $('fronts').append(button);
  }
  showFront(); showPlayers(); $('history').replaceChildren();
  for (const h of report.history) {
    const card=el('article',null,'archive'); card.append(el('h3',`Week of ${new Date(h.campaignStart*1000).toLocaleDateString()}`),el('p',`${n.format(h.recordedKills)} archived honorable kills`),el('p',`${n.format(h.captures)} recorded captures`),el('p',`${n.format(h.rankedPlayers)} archived kill rankings`)); $('history').append(card);
  }
  if (!report.history.length) $('history').append(el('p','No completed campaign archives in this report.','subtle'));
}
async function refresh(manual=false) {
  if (busy || (source !== 'remote' && !manual)) return;
  if (manual) { source='remote'; revision++; }
  const requestedRevision=revision; busy=true; $('refresh').disabled=true;
  try {
    const url=new URL(feedUrl,location.href); url.searchParams.set('t',Date.now());
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error(response.status===404 ? 'No reporter connected yet. Open a snapshot or explore the demo.' : `Feed unavailable (${response.status}).`);
    const raw=await response.text(); if (raw.length>MAX_BYTES) throw new Error('Report is too large.');
    const next=validateReport(JSON.parse(raw));
    if (revision !== requestedRevision || source !== 'remote') return;
    if (report && displaySource === 'remote' && next.generatedAt < report.generatedAt && !manual) throw new Error('Received an older report; retaining the last report.');
    render(next); notice();
  } catch (err) { if (revision===requestedRevision && source==='remote') notice(`${err.message}${report ? ' Last displayed report is retained.' : ''}`); }
  finally { busy=false; $('refresh').disabled=false; }
}
$('refresh').addEventListener('click', () => refresh(true));
$('demo').addEventListener('click', () => {revision++;source='demo';notice();render(demoReport());});
$('faction').addEventListener('change', () => report && showPlayers());
$('import').addEventListener('change', async event => {
  const file=event.target.files[0]; if (!file) return;
  try { if (file.size>MAX_BYTES) throw new Error('File is too large.'); const next=validateReport(JSON.parse(await file.text())); revision++;source='import';render(next);notice('This file is displayed only in your browser. It has not been uploaded.'); }
  catch(err) {notice(err.message);} finally {event.target.value='';}
});
try {
  const response=await fetch('./config.json'); if (!response.ok) throw new Error('configuration unavailable'); const config=await response.json();
  if (config.feedUrl) { const url=new URL(config.feedUrl,location.href); if (url.protocol!=='https:' && url.hostname!=='127.0.0.1' && url.hostname!=='localhost') throw new Error('Feed must use HTTPS.'); feedUrl=url.href; }
  if (config.repositoryUrl?.startsWith('https://github.com/')) { $('repo-link').href=config.repositoryUrl;$('repo-link').hidden=false; }
} catch(err) {notice(`Could not load feed settings: ${err.message}`);}
await refresh();
setInterval(() => refresh(),5000); setInterval(freshness,1000);
