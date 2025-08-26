# Chronicles of the Shattered Labyrinth — Web MVP (Render Web Service)

A browser-based vertical slice of your GDD using **HTML5 Canvas** and a minimal **Node/Express** backend.
- Daily-reshaping realm seed via `/api/daily-seed`
- Roguelike run with simple combat, relics/curses choices, and permadeath
- Local persistence (legacy meta: shards, upgrades, best floor) via `localStorage`
- Ready for Render deployment as a Web Service

## Run locally
```bash
npm install
npm start
# open http://localhost:10000
```

## Deploy to Render
1. Push this folder to a Git repo.
2. On Render: **New → Web Service**, connect the repo.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Create service and open your URL.

### Endpoints
- `/health` → health check
- `/api/version` → basic info
- `/api/daily-seed` → `{ date, seed }` (UTC-day based)
- `/api/relics` (GET/POST) → demo persistence for relics (in-memory)

## Controls
- Move: **WASD / Arrow keys**
- Light Attack: **J**, Heavy Attack: **K**, Skill: **L**, Dodge: **Space**
- Exit Run: button under the canvas

## Notes
- This is an MVP; co-op, matchmaking, and global leaderboards are stubs you can add later.
- All code is plain JS modules—no bundler required.