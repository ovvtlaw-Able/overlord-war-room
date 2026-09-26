# Overlord War Room

A public dashboard for Overlord warfront activity, objective control, campaign honorable-kill rankings, and archived campaign scores.

**Status:** dashboard and live transport implementation; the optical reader still requires validation inside the WoW client. No live reporter is connected by default. The demo is fictional and always labeled. The original Overlord addon is not redistributed in this repository.

## How live updates work

```text
Overlord addon → visible telemetry panel → Windows companion → HTTPS relay → GitHub Pages dashboard
```

The addon draws a 256 × 128 pixel data panel at the top-left of the game. The companion samples only that rectangle while WoW is the foreground application, validates and reconstructs the JSON report, and uploads the decoded public statistics. It does not save/upload screenshots, read game memory, or send game input. The panel must remain visible and unobstructed. Minimized, background, hidden-UI, and some exclusive-fullscreen configurations will stop updates. Use windowed or borderless mode. HDR/color filters or unusual render scaling may require disabling the filter or calibrating panel geometry.

Reports are split into checksummed packets and transmitted twice. Each frame lasts 250 ms. At the normal report size, expect updates on the order of tens of seconds, not an instantaneous combat-log stream. Exact latency and game performance are **not yet measured in WoW**. The dashboard polls every five seconds and labels live reports older than 60 seconds as stale. Large reports take longer; the hard limit is 160 KB. This version accepts one trusted reporting client and replaces its latest report. It never adds overlapping reporters' scores together.

## 1. Preview the dashboard

Requires Node.js 20 or newer. No packages are needed to run the website or companion.

```powershell
npm start
```

Open the printed local URL, then **Explore demo**. **Open snapshot** loads a JSON file only in your browser; it does not publish it. **Refresh** returns to the configured public feed.

## 2. Addon commands

The local addon in which this dashboard was developed includes `WebExport.lua`, a TOC entry for it, and the `/ov web` command. For a different addon installation, those changes must be installed separately with the addon author's permission; cloning this website repository alone does not install them.

After reloading the updated addon:

| Command | Behavior |
| --- | --- |
| `/ov web live` | Show the optical data panel for this session. |
| `/ov web stop` | Stop transmission and hide the panel. |
| `/ov web on` | Enable the saved-file fallback. |
| `/ov web off` | Stop live transmission, disable fallback, and clear the saved export on the next reload. |

Starting a live panel does not automatically publish anything. Publication requires running the companion with an upload endpoint and token. Live transmission is deliberately not restarted automatically after login/reload.

## 3. Test live capture locally

Keep WoW in the foreground after enabling `/ov web live`:

```powershell
node scripts/bridge.mjs --live
```

The companion writes `site/data/latest.json` when it reconstructs a valid report. A dashboard opened on another screen/device may show it; tabbing away from WoW pauses capture. Ctrl+C stops the companion. The reader does not automate refocusing WoW.

If no reports arrive, check that the colored panel is visible, WoW is in the foreground, and the game uses windowed/borderless mode. Geometry defaults to 16 physical pixels from the game client top-left and 4 physical pixels per cell. Override only if the actual panel position/scale differs:

```powershell
node scripts/bridge.mjs --live --x 16 --y 16 --cell 4
```

## 4. Deploy the live relay

The relay uses a Cloudflare Worker and one SQLite-backed Durable Object. It stores the latest report, not an unlimited historical stream. Account login is required. Public traffic consumes Worker requests; review your account's limits and pricing before inviting a large audience. At five-second polling, each continuously open viewer generates roughly 17,280 requests/day.

```powershell
npm install
npx wrangler login
npx wrangler deploy --config relay/wrangler.jsonc
npx wrangler secret put UPLOAD_TOKEN --config relay/wrangler.jsonc
```

Use a randomly generated token with at least 32 characters for the secret. Store it in a password manager. Never put it in the repository, dashboard configuration, screenshots, or chat. The relay rejects unauthenticated writes and accepts only recent live reports with the supported allowlisted schema.

On your reporting computer, supply the same token as the `OVERLORD_UPLOAD_TOKEN` environment variable. In PowerShell 7 you can avoid displaying it:

```powershell
$env:OVERLORD_UPLOAD_TOKEN = Read-Host 'Reporter upload token' -MaskInput
node scripts/bridge.mjs --live --endpoint 'https://YOUR-WORKER.workers.dev/latest'
```

The token is sent only to the endpoint explicitly supplied above. Set `feedUrl` in `site/config.json` to that same public `/latest` URL. The browser uses public GET requests and needs no token. Only the decoded report is uploaded; raw SavedVariables and account configuration stay on your computer.

The backend is intentionally a single trusted reporter feed, not an anti-cheat or authoritative realm census. A holder of the upload token can submit fabricated data. Keep that token private and rotate it if exposed.

## 5. Publish on GitHub Pages

Use this `web` directory as the root of its own GitHub repository. Do not publish the entire installed addon directory or any `WTF` / SavedVariables folder.

The included workflow deploys only `site/` when the `main` branch changes. Set repository **Settings → Pages → Source → GitHub Actions**. `repositoryUrl` in `site/config.json` controls the footer link. The website works under a repository subpath.

`site/data/latest.json` is ignored by Git. The public live feed comes from the configured relay. If you intentionally want a static snapshot instead, review its character/guild data before explicitly adding it to Git. Static Pages deployments are not the live transport.

## Saved-file fallback

Enable `/ov web on`, then reload/logout and point the companion at the account's SavedVariables file, **not** the addon source file:

```powershell
node scripts/bridge.mjs --source 'F:\World of Warcraft\_classic_beta_\WTF\Account\YOUR-ACCOUNT\SavedVariables\Overlord.lua' --watch
```

The bridge extracts only the hex-encoded `OverlordWebSnapshot` value. It never evaluates Lua. Saved-file reports are snapshots, cannot refresh during uninterrupted play, and cannot be uploaded to the live-only relay.

## What the numbers mean

- Front activity means an action was reported within five minutes of the observation timestamp. It is not an online player count.
- Held objectives exclude contested and unconfirmed zones. During an assault, `previousOwner` is the defender and `owner` is the attacker.
- Player rows use Overlord's existing alias merging. Rankings cover up to 100 players by honorable kills across all fronts; capture counts are for those players, not a separate capture leaderboard.
- Campaign archives are limited recorded leaderboards, not realm-wide totals. This version does not invent damage, healing, deaths, K/D ratios, battle boundaries, or individual kill events that are not reliably available in the exported data.
- Public fields include character names, guilds, class, faction, scores, objectives, and timestamps. Account IDs, Battle.net IDs, settings, private messages, and reporter filesystem paths are excluded.

## Stop publication / remove data

Stop the companion and run `/ov web off`. Already published data is not automatically retracted. To clear the relay, send an authenticated `DELETE` to its `/latest` endpoint using the same upload token. Browsers may retain a previously loaded report until refreshed. If a static report was committed, remove it from the repository and consider its Git history as well.

## Development checks

```powershell
npm ci
npm test
npx wrangler deploy --dry-run --config relay/wrangler.jsonc
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/capture-panel.ps1 -ValidateOnly
```

Tests exercise packet reassembly, corruption detection, retry cycles, schema allowlisting, auth, stale updates, and deletions. When run inside the installed addon directory, an additional mocked Lua test loads the actual exporter and slash handler and decodes their rendered RGB packets. It skips in a standalone website checkout. These checks do not substitute for a real WoW-client capture test.

This is a community tool, not an official Blizzard service.
