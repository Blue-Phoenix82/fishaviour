# Fishaviour

A small 3D arcade game: you are a fish in a lake full of friends, and three humans are
fishing from the shore. Your job is to shove the fish away from the bait before they get
hooked. Every fish caught adds **+1** — the lowest score wins.

## Run it

ES modules need a local web server (opening `index.html` directly will not work).

**Windows:** double-click `run.bat`.

**Any platform:**

```bash
python -m http.server 8123 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8123>.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | swim |
| `Shift` | sprint |
| `Esc` | pause / resume |
| `Enter` / `Space` | start or replay |

## Rules

- 60 second round, 3 humans, 30 fish.
- Each bobber can lure **one fish at a time**. Fish heading for bait glow and carry a floating `!` marker.
- When a fish reaches the bobber it starts **biting** for ~1.3 s — the bobber dips and the fish glows brighter. Ram it in that window and it gets away.
- A fish you shove is spooked for **10 seconds** and will ignore bait during that time.
- Fish caught = score. Fewer is better. Your best (lowest) score is stored in `localStorage`.

## How it is built

Plain HTML + ES modules + a locally vendored copy of Three.js (no build step, no network needed).

```
index.html          UI, HUD, menus, styles
vendor/             three.module.js
src/main.js         renderer, camera, boot
src/game.js         round loop, scoring, camera, input, HUD wiring
src/world.js        sky, sun, water, shore, trees, dock, props
src/fish.js         low-poly fish, AI, bait claiming, biting, respawn
src/humans.js       humans, rods, lines, bobbers, cast/reel state machine
src/player.js       the player fish and movement
src/audio.js        tiny procedural WebAudio sound effects
```

## Tuning knobs

- `src/game.js` — `ROUND_TIME` (60), `FISH_COUNT` (30)
- `src/humans.js` — `LURE_RADIUS` (9), cast/reel timings, `HUMAN_SPOTS` in `src/world.js`
- `src/fish.js` — `BITE_TIME` (1.35 s), `RESPAWN_DELAY` (6 s), swim speeds, 10 s spooked timer in `push()`
- `src/player.js` — `MAX_SPEED`, `SPRINT_SPEED`
